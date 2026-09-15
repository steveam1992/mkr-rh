import { dialog } from 'electron'
import * as XLSX from 'xlsx'
import { hoy, round2, antiguedad, primerDiaDelMes, ultimoDiaDelMes, sumarDias } from '../utils'
import { saldoVacaciones, vencimientoPeriodo } from '../lft'

const ETIQUETAS_BAJA = {
  renuncia: 'Renuncia voluntaria',
  despido: 'Despido',
  fin_contrato: 'Fin de contrato',
  abandono: 'Abandono de empleo',
  jubilacion: 'Jubilación',
  defuncion: 'Defunción',
  otro: 'Otro'
}

function tablaVacaciones(db) {
  return db.prepare('SELECT * FROM vacaciones_tabla ORDER BY anio').all()
}

function nombreDe(e) {
  return [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' ')
}

const REPORTES = {
  plantilla(db) {
    const filas = db.prepare(
      `SELECT e.*, d.nombre AS departamento, p.nombre AS puesto,
              (j.nombre || ' ' || j.apellido_paterno) AS jefe
       FROM empleados e
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       LEFT JOIN puestos p ON p.id = e.puesto_id
       LEFT JOIN empleados j ON j.id = e.jefe_id
       WHERE e.estatus = 'activo'
       ORDER BY d.nombre, e.apellido_paterno, e.nombre`
    ).all()

    return {
      nombre: 'Plantilla',
      filas: filas.map((e) => ({
        'No. empleado': e.numero_empleado,
        Nombre: nombreDe(e),
        Departamento: e.departamento || '',
        Puesto: e.puesto || '',
        Jefe: e.jefe || '',
        'Fecha de ingreso': e.fecha_ingreso,
        Antigüedad: antiguedad(e.fecha_ingreso).texto,
        Contrato: e.tipo_contrato,
        'Salario diario': e.salario_diario,
        'Salario mensual': e.salario_mensual,
        SDI: e.salario_diario_integrado,
        RFC: e.rfc || '',
        CURP: e.curp || '',
        NSS: e.nss || '',
        Teléfono: e.telefono || '',
        Correo: e.correo || ''
      }))
    }
  },

  vacaciones(db) {
    const tabla = tablaVacaciones(db)
    const empleados = db.prepare(
      `SELECT e.*, d.nombre AS departamento
       FROM empleados e LEFT JOIN departamentos d ON d.id = e.departamento_id
       WHERE e.estatus = 'activo' ORDER BY e.apellido_paterno, e.nombre`
    ).all()

    return {
      nombre: 'Saldos de vacaciones',
      filas: empleados.map((e) => {
        const tomados = db.prepare(
          `SELECT COALESCE(SUM(dias), 0) AS dias FROM vacaciones
           WHERE empleado_id = ? AND estatus IN ('aprobada','disfrutada')`
        ).get(e.id).dias
        const ajustes = db.prepare(
          'SELECT COALESCE(SUM(dias), 0) AS dias FROM vacaciones_ajustes WHERE empleado_id = ?'
        ).get(e.id).dias
        const saldo = saldoVacaciones({ fechaIngreso: e.fecha_ingreso, tabla, diasTomados: tomados, ajustes, alDia: hoy() })

        return {
          'No. empleado': e.numero_empleado,
          Nombre: nombreDe(e),
          Departamento: e.departamento || '',
          'Fecha de ingreso': e.fecha_ingreso,
          'Años cumplidos': saldo.anios,
          'Días del año en curso': saldo.diasDelAnioEnCurso,
          'Generados (años cumplidos)': saldo.generados,
          'Proporcional en curso': saldo.proporcional,
          Ajustes: saldo.ajustes,
          Tomados: saldo.tomados,
          Disponibles: saldo.disponibles,
          'Disponibles + proporcional (finiquito)': saldo.porFiniquito,
          'Prescribe el': vencimientoPeriodo(e.fecha_ingreso, Math.max(1, saldo.anios)) || ''
        }
      })
    }
  },

  incidencias(db, { desde, hasta }) {
    const d = desde || primerDiaDelMes()
    const h = hasta || ultimoDiaDelMes()

    const filas = db.prepare(
      `SELECT e.numero_empleado, e.nombre, e.apellido_paterno, e.apellido_materno, dep.nombre AS departamento,
              SUM(CASE WHEN a.estatus = 'asistencia' THEN 1 ELSE 0 END) AS asistencias,
              SUM(CASE WHEN a.estatus = 'retardo' THEN 1 ELSE 0 END) AS retardos,
              SUM(CASE WHEN a.estatus = 'falta' THEN 1 ELSE 0 END) AS faltas,
              COALESCE(SUM(a.horas), 0) AS horas,
              COALESCE(SUM(a.horas_extra), 0) AS horas_extra,
              COALESCE(SUM(a.minutos_retardo), 0) AS minutos_retardo
       FROM empleados e
       LEFT JOIN asistencia a ON a.empleado_id = e.id AND a.fecha BETWEEN ? AND ?
       LEFT JOIN departamentos dep ON dep.id = e.departamento_id
       WHERE e.estatus = 'activo'
       GROUP BY e.id ORDER BY faltas DESC, retardos DESC`
    ).all(d, h)

    return {
      nombre: `Incidencias ${d} a ${h}`,
      filas: filas.map((f) => ({
        'No. empleado': f.numero_empleado,
        Nombre: nombreDe(f),
        Departamento: f.departamento || '',
        Asistencias: f.asistencias,
        Retardos: f.retardos,
        Faltas: f.faltas,
        'Minutos de retardo': f.minutos_retardo,
        'Horas trabajadas': round2(f.horas),
        'Horas extra': round2(f.horas_extra)
      }))
    }
  },

  nomina(db, { periodo_id }) {
    const periodo = db.prepare('SELECT * FROM nomina_periodos WHERE id = ?').get(periodo_id)
    if (!periodo) return null

    const filas = db.prepare(
      `SELECT r.*, e.numero_empleado, e.nombre, e.apellido_paterno, e.apellido_materno,
              e.rfc, e.curp, e.nss, d.nombre AS departamento
       FROM nomina_recibos r
       JOIN empleados e ON e.id = r.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       WHERE r.periodo_id = ? ORDER BY e.apellido_paterno, e.nombre`
    ).all(periodo_id)

    return {
      nombre: `Nómina ${periodo.nombre}`.slice(0, 31),
      filas: filas.map((r) => ({
        'No. empleado': r.numero_empleado,
        Nombre: nombreDe(r),
        Departamento: r.departamento || '',
        RFC: r.rfc || '',
        NSS: r.nss || '',
        'Días pagados': r.dias_trabajados,
        Faltas: r.dias_falta,
        Incapacidad: r.dias_incapacidad,
        'Salario diario': r.salario_diario,
        Sueldo: r.sueldo,
        'Horas extra': r.monto_horas_extra,
        'Prima vacacional': r.prima_vacacional,
        Aguinaldo: r.aguinaldo,
        Bonos: r.bonos,
        'Otras percepciones': r.otras_percepciones,
        'Total percepciones': r.total_percepciones,
        'Percepciones exentas': r.percepciones_exentas,
        ISR: r.isr,
        Subsidio: r.subsidio,
        IMSS: r.imss,
        INFONAVIT: r.infonavit,
        FONACOT: r.fonacot,
        Préstamos: r.prestamos,
        'Descuento faltas': r.descuento_faltas,
        'Otras deducciones': r.otras_deducciones,
        'Total deducciones': r.total_deducciones,
        Neto: r.neto
      }))
    }
  },

  bajas(db, { desde, hasta }) {
    const d = desde || `${new Date().getFullYear()}-01-01`
    const h = hasta || hoy()
    const filas = db.prepare(
      `SELECT b.*, e.numero_empleado, e.nombre, e.apellido_paterno, e.apellido_materno,
              e.fecha_ingreso, dep.nombre AS departamento, p.nombre AS puesto
       FROM bajas b
       JOIN empleados e ON e.id = b.empleado_id
       LEFT JOIN departamentos dep ON dep.id = e.departamento_id
       LEFT JOIN puestos p ON p.id = e.puesto_id
       WHERE b.fecha_baja BETWEEN ? AND ? ORDER BY b.fecha_baja DESC`
    ).all(d, h)

    return {
      nombre: 'Bajas',
      filas: filas.map((b) => ({
        'No. empleado': b.numero_empleado,
        Nombre: nombreDe(b),
        Departamento: b.departamento || '',
        Puesto: b.puesto || '',
        'Fecha de ingreso': b.fecha_ingreso,
        'Fecha de baja': b.fecha_baja,
        Antigüedad: antiguedad(b.fecha_ingreso, b.fecha_baja).texto,
        Motivo: ETIQUETAS_BAJA[b.motivo] || b.motivo,
        Descripción: b.descripcion || '',
        'Días de vacaciones': b.dias_vacaciones,
        Vacaciones: b.monto_vacaciones,
        'Prima vacacional': b.monto_prima_vacacional,
        Aguinaldo: b.monto_aguinaldo,
        'Salarios pendientes': b.monto_salarios,
        'Otras percepciones': b.otras_percepciones,
        Deducciones: b.deducciones,
        'Total finiquito': b.total_finiquito
      }))
    }
  },

  documentos(db, { dias = 90 } = {}) {
    const limite = sumarDias(hoy(), dias)
    const filas = db.prepare(
      `SELECT d.*, e.numero_empleado, e.nombre, e.apellido_paterno, e.apellido_materno,
              dep.nombre AS departamento
       FROM documentos d
       JOIN empleados e ON e.id = d.empleado_id
       LEFT JOIN departamentos dep ON dep.id = e.departamento_id
       WHERE e.estatus = 'activo' AND d.fecha_vencimiento IS NOT NULL AND d.fecha_vencimiento <= ?
       ORDER BY d.fecha_vencimiento`
    ).all(limite)

    return {
      nombre: 'Documentos por vencer',
      filas: filas.map((d) => ({
        'No. empleado': d.numero_empleado,
        Nombre: nombreDe(d),
        Departamento: d.departamento || '',
        Documento: d.nombre,
        Tipo: d.tipo,
        Emisión: d.fecha_emision || '',
        Vencimiento: d.fecha_vencimiento,
        Estado: d.fecha_vencimiento < hoy() ? 'VENCIDO' : 'Por vencer'
      }))
    }
  },

  incapacidades(db, { desde, hasta }) {
    const d = desde || `${new Date().getFullYear()}-01-01`
    const h = hasta || hoy()
    const filas = db.prepare(
      `SELECT i.*, e.numero_empleado, e.nombre, e.apellido_paterno, e.apellido_materno,
              e.nss, e.salario_diario, dep.nombre AS departamento
       FROM incapacidades i
       JOIN empleados e ON e.id = i.empleado_id
       LEFT JOIN departamentos dep ON dep.id = e.departamento_id
       WHERE i.fecha_inicio <= ? AND i.fecha_fin >= ? ORDER BY i.fecha_inicio DESC`
    ).all(h, d)

    return {
      nombre: 'Incapacidades',
      filas: filas.map((i) => ({
        'No. empleado': i.numero_empleado,
        Nombre: nombreDe(i),
        Departamento: i.departamento || '',
        NSS: i.nss || '',
        Folio: i.folio || '',
        Tipo: i.tipo,
        Control: i.control,
        Inicio: i.fecha_inicio,
        Fin: i.fecha_fin,
        Días: i.dias,
        '% de pago': i.porcentaje_pago,
        'Subsidio estimado': round2((i.salario_diario * i.porcentaje_pago / 100) * i.dias),
        Notas: i.notas || ''
      }))
    }
  }
}

export function register(ipcMain, getDb) {
  ipcMain.handle('reportes:disponibles', () => [
    { clave: 'plantilla', nombre: 'Plantilla de empleados', descripcion: 'Todos los datos del personal activo' },
    { clave: 'vacaciones', nombre: 'Saldos de vacaciones', descripcion: 'Días generados, tomados y disponibles' },
    { clave: 'incidencias', nombre: 'Incidencias', descripcion: 'Asistencias, faltas, retardos y horas extra', rango: true },
    { clave: 'nomina', nombre: 'Nómina por periodo', descripcion: 'Recibos de un periodo completo', periodo: true },
    { clave: 'bajas', nombre: 'Bajas y finiquitos', descripcion: 'Rotación de personal con montos pagados', rango: true },
    { clave: 'documentos', nombre: 'Documentos por vencer', descripcion: 'Expedientes con papeles vencidos o próximos' },
    { clave: 'incapacidades', nombre: 'Incapacidades', descripcion: 'Casos, días y subsidio estimado', rango: true }
  ])

  ipcMain.handle('reportes:previsualizar', (event, { tipo, params = {} }) => {
    const generador = REPORTES[tipo]
    if (!generador) return { ok: false, mensaje: 'Reporte no disponible' }
    const reporte = generador(getDb(), params)
    if (!reporte) return { ok: false, mensaje: 'No hay datos para ese reporte' }
    return { ok: true, nombre: reporte.nombre, filas: reporte.filas.slice(0, 200), total: reporte.filas.length }
  })

  ipcMain.handle('reportes:exportar', async (event, { tipo, params = {} }) => {
    const generador = REPORTES[tipo]
    if (!generador) return { ok: false, mensaje: 'Reporte no disponible' }

    const reporte = generador(getDb(), params)
    if (!reporte) return { ok: false, mensaje: 'No hay datos para ese reporte' }
    if (reporte.filas.length === 0) return { ok: false, mensaje: 'El reporte no tiene registros' }

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Guardar reporte',
      defaultPath: `${tipo}-${hoy()}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (canceled || !filePath) return { ok: false, canceled: true }

    try {
      const hoja = XLSX.utils.json_to_sheet(reporte.filas)
      hoja['!cols'] = Object.keys(reporte.filas[0]).map((k) => ({
        wch: Math.min(40, Math.max(12, k.length + 4))
      }))
      const libro = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(libro, hoja, reporte.nombre.slice(0, 31))
      XLSX.writeFile(libro, filePath)
      return { ok: true, ruta: filePath, registros: reporte.filas.length }
    } catch (e) {
      return { ok: false, mensaje: `No se pudo guardar el reporte: ${e.message}` }
    }
  })
}
