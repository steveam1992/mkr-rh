import { hoy, sumarDias, round2, fecha, aIso, antiguedad, primerDiaDelMes, ultimoDiaDelMes } from '../utils'
import { vencimientoPeriodo, derechoVacaciones } from '../lft'

const DIAS_ALERTA = 45

// Cumpleanos y aniversarios se comparan por mes-dia para no depender del ano.
function entreMesDia(mesDia, desde, hasta) {
  return mesDia >= desde && mesDia <= hasta
}

export function register(ipcMain, getDb) {
  ipcMain.handle('dashboard:resumen', () => {
    const db = getDb()
    const dia = hoy()
    const anio = Number(dia.slice(0, 4))
    const inicioMes = primerDiaDelMes(dia)
    const finMes = ultimoDiaDelMes(dia)

    const activos = db.prepare("SELECT COUNT(*) AS n FROM empleados WHERE estatus = 'activo'").get().n
    const bajasDelAnio = db.prepare('SELECT COUNT(*) AS n FROM bajas WHERE fecha_baja LIKE ?').get(`${anio}-%`).n
    const altasDelAnio = db.prepare(
      "SELECT COUNT(*) AS n FROM empleados WHERE fecha_ingreso LIKE ?"
    ).get(`${anio}-%`).n
    const nomina = db.prepare(
      "SELECT COALESCE(SUM(salario_mensual), 0) AS total FROM empleados WHERE estatus = 'activo'"
    ).get().total

    // Rotacion = bajas del ano / plantilla promedio, expresada en porcentaje.
    const plantillaPromedio = Math.max(1, activos + bajasDelAnio / 2)
    const rotacion = round2((bajasDelAnio / plantillaPromedio) * 100)

    const porDepartamento = db.prepare(
      `SELECT COALESCE(d.nombre, 'Sin departamento') AS nombre, COUNT(*) AS n
       FROM empleados e
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       WHERE e.estatus = 'activo'
       GROUP BY d.id ORDER BY n DESC`
    ).all()

    const antiguedadPromedio = db.prepare(
      "SELECT fecha_ingreso FROM empleados WHERE estatus = 'activo'"
    ).all()
    const aniosPromedio = antiguedadPromedio.length
      ? round2(antiguedadPromedio.reduce((t, e) => t + antiguedad(e.fecha_ingreso).totalDias, 0) /
          antiguedadPromedio.length / 365)
      : 0

    return {
      activos,
      altasDelAnio,
      bajasDelAnio,
      rotacion,
      nominaMensual: round2(nomina),
      aniosPromedio,
      porDepartamento,
      vacacionesPendientes: db.prepare(
        "SELECT COUNT(*) AS n FROM vacaciones WHERE estatus = 'pendiente'"
      ).get().n,
      permisosPendientes: db.prepare(
        "SELECT COUNT(*) AS n FROM permisos WHERE estatus = 'pendiente'"
      ).get().n,
      ausentesHoy: db.prepare(
        `SELECT COUNT(DISTINCT empleado_id) AS n FROM (
           SELECT empleado_id FROM vacaciones WHERE estatus IN ('aprobada','disfrutada') AND fecha_inicio <= ? AND fecha_fin >= ?
           UNION SELECT empleado_id FROM incapacidades WHERE fecha_inicio <= ? AND fecha_fin >= ?
           UNION SELECT empleado_id FROM permisos WHERE estatus = 'aprobado' AND fecha_inicio <= ? AND fecha_fin >= ?
         )`
      ).get(dia, dia, dia, dia, dia, dia).n,
      periodoMes: { inicio: inicioMes, fin: finMes }
    }
  })

  // Quien no esta hoy y por que.
  ipcMain.handle('dashboard:ausenciasHoy', (event, { fecha: dia } = {}) => {
    const db = getDb()
    const f = dia || hoy()
    const vacaciones = db.prepare(
      `SELECT e.id, (e.nombre || ' ' || e.apellido_paterno) AS empleado, d.nombre AS departamento,
              v.fecha_fin AS regresa, 'vacaciones' AS motivo
       FROM vacaciones v JOIN empleados e ON e.id = v.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       WHERE v.estatus IN ('aprobada','disfrutada') AND v.fecha_inicio <= ? AND v.fecha_fin >= ?
         AND e.estatus = 'activo'`
    ).all(f, f)

    const incapacidades = db.prepare(
      `SELECT e.id, (e.nombre || ' ' || e.apellido_paterno) AS empleado, d.nombre AS departamento,
              i.fecha_fin AS regresa, 'incapacidad' AS motivo
       FROM incapacidades i JOIN empleados e ON e.id = i.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       WHERE i.fecha_inicio <= ? AND i.fecha_fin >= ? AND e.estatus = 'activo'`
    ).all(f, f)

    const permisos = db.prepare(
      `SELECT e.id, (e.nombre || ' ' || e.apellido_paterno) AS empleado, d.nombre AS departamento,
              p.fecha_fin AS regresa, p.tipo AS motivo
       FROM permisos p JOIN empleados e ON e.id = p.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       WHERE p.estatus = 'aprobado' AND p.fecha_inicio <= ? AND p.fecha_fin >= ? AND e.estatus = 'activo'`
    ).all(f, f)

    return [...incapacidades, ...vacaciones, ...permisos]
  })

  ipcMain.handle('dashboard:celebraciones', (event, { dias = 31 } = {}) => {
    const db = getDb()
    const dia = hoy()
    const limite = sumarDias(dia, dias)
    const desde = dia.slice(5)
    const hasta = limite.slice(5)
    // Si el rango cruza el cambio de ano se parte en dos tramos.
    const cruzaAnio = hasta < desde

    const empleados = db.prepare(
      `SELECT id, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_ingreso, foto
       FROM empleados WHERE estatus = 'activo'`
    ).all()

    const dentro = (iso) => {
      if (!iso) return false
      const md = String(iso).slice(5)
      return cruzaAnio ? (md >= desde || md <= hasta) : entreMesDia(md, desde, hasta)
    }

    const nombreDe = (e) => [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' ')

    const cumpleanos = empleados
      .filter((e) => dentro(e.fecha_nacimiento))
      .map((e) => ({
        id: e.id,
        nombre_completo: nombreDe(e),
        foto: e.foto,
        fecha: e.fecha_nacimiento,
        mesDia: String(e.fecha_nacimiento).slice(5),
        edad: antiguedad(e.fecha_nacimiento).anios + 1
      }))
      .sort((a, b) => ordenarPorMesDia(a.mesDia, b.mesDia, desde))

    const aniversarios = empleados
      .filter((e) => dentro(e.fecha_ingreso) && antiguedad(e.fecha_ingreso).anios >= 0)
      .map((e) => ({
        id: e.id,
        nombre_completo: nombreDe(e),
        foto: e.foto,
        fecha: e.fecha_ingreso,
        mesDia: String(e.fecha_ingreso).slice(5),
        anios: antiguedad(e.fecha_ingreso).anios + 1
      }))
      .filter((a) => a.anios >= 1)
      .sort((a, b) => ordenarPorMesDia(a.mesDia, b.mesDia, desde))

    return { cumpleanos, aniversarios }
  })

  // Todo lo que requiere que alguien de RH haga algo pronto.
  ipcMain.handle('dashboard:alertas', () => {
    const db = getDb()
    const dia = hoy()
    const limite = sumarDias(dia, DIAS_ALERTA)
    const alertas = []

    for (const d of db.prepare(
      `SELECT d.id, d.nombre, d.fecha_vencimiento, d.empleado_id,
              (e.nombre || ' ' || e.apellido_paterno) AS empleado
       FROM documentos d JOIN empleados e ON e.id = d.empleado_id
       WHERE d.fecha_vencimiento IS NOT NULL AND d.fecha_vencimiento <= ? AND e.estatus = 'activo'
       ORDER BY d.fecha_vencimiento`
    ).all(limite)) {
      alertas.push({
        tipo: 'documento',
        gravedad: d.fecha_vencimiento < dia ? 'alta' : 'media',
        empleado_id: d.empleado_id,
        titulo: `${d.nombre} de ${d.empleado}`,
        detalle: d.fecha_vencimiento < dia
          ? `Vencido desde el ${d.fecha_vencimiento}`
          : `Vence el ${d.fecha_vencimiento}`,
        fecha: d.fecha_vencimiento
      })
    }

    for (const e of db.prepare(
      `SELECT id, (nombre || ' ' || apellido_paterno) AS empleado, fecha_fin_contrato
       FROM empleados
       WHERE estatus = 'activo' AND fecha_fin_contrato IS NOT NULL AND fecha_fin_contrato <= ?
       ORDER BY fecha_fin_contrato`
    ).all(limite)) {
      alertas.push({
        tipo: 'contrato',
        gravedad: e.fecha_fin_contrato < dia ? 'alta' : 'media',
        empleado_id: e.id,
        titulo: `Contrato de ${e.empleado}`,
        detalle: e.fecha_fin_contrato < dia
          ? `Venció el ${e.fecha_fin_contrato}`
          : `Termina el ${e.fecha_fin_contrato}`,
        fecha: e.fecha_fin_contrato
      })
    }

    // Vacaciones que estan por prescribir (18 meses tras cumplir el ano, art. 81 LFT).
    const tabla = db.prepare('SELECT * FROM vacaciones_tabla ORDER BY anio').all()
    const activos = db.prepare(
      "SELECT id, nombre, apellido_paterno, fecha_ingreso FROM empleados WHERE estatus = 'activo'"
    ).all()
    for (const e of activos) {
      const derecho = derechoVacaciones(e.fecha_ingreso, tabla, dia)
      if (derecho.anios < 1) continue
      const vence = vencimientoPeriodo(e.fecha_ingreso, derecho.anios)
      if (vence && vence <= sumarDias(dia, 90)) {
        const tomados = db.prepare(
          `SELECT COALESCE(SUM(dias), 0) AS dias FROM vacaciones
           WHERE empleado_id = ? AND estatus IN ('aprobada','disfrutada')`
        ).get(e.id).dias
        const disponibles = round2(derecho.total - tomados)
        if (disponibles > 0) {
          alertas.push({
            tipo: 'vacaciones',
            gravedad: vence < dia ? 'alta' : 'baja',
            empleado_id: e.id,
            titulo: `${e.nombre} ${e.apellido_paterno} tiene ${disponibles} día(s) sin tomar`,
            detalle: `El periodo prescribe el ${vence}`,
            fecha: vence
          })
        }
      }
    }

    for (const v of db.prepare(
      `SELECT v.id, v.fecha_inicio, (e.nombre || ' ' || e.apellido_paterno) AS empleado, e.id AS empleado_id
       FROM vacaciones v JOIN empleados e ON e.id = v.empleado_id
       WHERE v.estatus = 'pendiente' ORDER BY v.fecha_inicio`
    ).all()) {
      alertas.push({
        tipo: 'solicitud',
        gravedad: v.fecha_inicio <= sumarDias(dia, 7) ? 'alta' : 'media',
        empleado_id: v.empleado_id,
        titulo: `Vacaciones por autorizar de ${v.empleado}`,
        detalle: `Inician el ${v.fecha_inicio}`,
        fecha: v.fecha_inicio
      })
    }

    const orden = { alta: 0, media: 1, baja: 2 }
    return alertas.sort((a, b) => (orden[a.gravedad] - orden[b.gravedad]) || String(a.fecha).localeCompare(b.fecha))
  })

  // Altas y bajas de los ultimos 12 meses para la grafica de plantilla.
  ipcMain.handle('dashboard:movimientoPlantilla', () => {
    const db = getDb()
    const meses = []
    const cursor = fecha(primerDiaDelMes(hoy()))
    cursor.setMonth(cursor.getMonth() - 11)

    for (let i = 0; i < 12; i++) {
      const inicio = aIso(cursor)
      const fin = ultimoDiaDelMes(inicio)
      meses.push({
        mes: inicio.slice(0, 7),
        altas: db.prepare('SELECT COUNT(*) AS n FROM empleados WHERE fecha_ingreso BETWEEN ? AND ?')
          .get(inicio, fin).n,
        bajas: db.prepare('SELECT COUNT(*) AS n FROM bajas WHERE fecha_baja BETWEEN ? AND ?')
          .get(inicio, fin).n
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return meses
  })
}

function ordenarPorMesDia(a, b, desde) {
  const norm = (md) => (md >= desde ? `0${md}` : `1${md}`)
  return norm(a).localeCompare(norm(b))
}
