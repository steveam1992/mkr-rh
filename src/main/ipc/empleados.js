import { dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { limpiar, oNulo, num, hoy, round2, antiguedad, edad } from '../utils'
import { salarioDiarioIntegrado, saldoVacaciones, calcularFiniquito } from '../lft'

const CAMPOS = [
  'numero_empleado', 'nombre', 'apellido_paterno', 'apellido_materno', 'fecha_nacimiento',
  'genero', 'estado_civil', 'curp', 'rfc', 'nss', 'telefono', 'correo', 'contacto_emergencia',
  'telefono_emergencia', 'direccion', 'ciudad', 'estado', 'cp', 'departamento_id', 'puesto_id',
  'jefe_id', 'fecha_ingreso', 'tipo_contrato', 'fecha_fin_contrato', 'salario_diario',
  'salario_mensual', 'salario_diario_integrado', 'tipo_jornada', 'hora_entrada', 'hora_salida',
  'dias_descanso', 'banco', 'clabe', 'foto', 'notas'
]

const NUMERICOS = ['departamento_id', 'puesto_id', 'jefe_id', 'salario_diario', 'salario_mensual', 'salario_diario_integrado']

function contexto(db) {
  return {
    cfg: db.prepare('SELECT * FROM configuracion WHERE id = 1').get(),
    tabla: db.prepare('SELECT * FROM vacaciones_tabla ORDER BY anio').all()
  }
}

// El salario diario manda; si solo llega el mensual se deriva a 30 dias y viceversa.
function normalizarSalario(data) {
  let diario = num(data.salario_diario)
  let mensual = num(data.salario_mensual)
  if (diario > 0 && mensual <= 0) mensual = round2(diario * 30)
  else if (mensual > 0 && diario <= 0) diario = round2(mensual / 30)
  return { diario: round2(diario), mensual: round2(mensual) }
}

function prepararValores(db, data, { cfg, tabla }) {
  const { diario, mensual } = normalizarSalario(data)
  const anios = antiguedad(data.fecha_ingreso).anios
  const sdi = salarioDiarioIntegrado({
    salarioDiario: diario,
    anios,
    tabla,
    diasAguinaldo: cfg.dias_aguinaldo,
    primaVacacional: cfg.prima_vacacional
  })

  const valores = {}
  for (const campo of CAMPOS) {
    if (NUMERICOS.includes(campo)) valores[campo] = data[campo] ? num(data[campo]) : null
    else valores[campo] = oNulo(data[campo])
  }
  valores.salario_diario = diario
  valores.salario_mensual = mensual
  valores.salario_diario_integrado = sdi
  valores.nombre = limpiar(data.nombre)
  valores.apellido_paterno = limpiar(data.apellido_paterno)
  valores.fecha_ingreso = data.fecha_ingreso
  valores.tipo_contrato = data.tipo_contrato || 'indeterminado'
  valores.tipo_jornada = data.tipo_jornada || 'diurna'
  return valores
}

function validar(data) {
  if (!limpiar(data.nombre)) return 'Escribe el nombre del empleado'
  if (!limpiar(data.apellido_paterno)) return 'Escribe el apellido paterno'
  if (!data.fecha_ingreso) return 'Selecciona la fecha de ingreso'
  if (data.tipo_contrato === 'determinado' && !data.fecha_fin_contrato) {
    return 'Un contrato por tiempo determinado necesita fecha de término'
  }
  if (num(data.salario_diario) <= 0 && num(data.salario_mensual) <= 0) {
    return 'Captura el salario diario o el mensual'
  }
  return null
}

function registrarMovimiento(db, { empleado_id, tipo, fecha, anterior, nuevo, nota, usuario_id }) {
  db.prepare(
    `INSERT INTO movimientos (empleado_id, tipo, fecha, valor_anterior, valor_nuevo, nota, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(empleado_id, tipo, fecha || hoy(), anterior ?? null, nuevo ?? null, nota || null, usuario_id || null)
}

function diasTomados(db, empleado_id) {
  return db.prepare(
    `SELECT COALESCE(SUM(dias), 0) AS dias FROM vacaciones
     WHERE empleado_id = ? AND estatus IN ('aprobada', 'disfrutada')`
  ).get(empleado_id).dias
}

function ajustesVacaciones(db, empleado_id) {
  return db.prepare('SELECT COALESCE(SUM(dias), 0) AS dias FROM vacaciones_ajustes WHERE empleado_id = ?')
    .get(empleado_id).dias
}

export function saldoDeVacaciones(db, empleado, alDia = hoy()) {
  const { tabla } = contexto(db)
  return saldoVacaciones({
    fechaIngreso: empleado.fecha_ingreso,
    tabla,
    diasTomados: diasTomados(db, empleado.id),
    ajustes: ajustesVacaciones(db, empleado.id),
    alDia
  })
}

export function register(ipcMain, getDb) {
  ipcMain.handle('empleados:listar', (event, filtros = {}) => {
    const db = getDb()
    const condiciones = []
    const params = []

    const estatus = filtros.estatus || 'activo'
    if (estatus !== 'todos') {
      condiciones.push('e.estatus = ?')
      params.push(estatus)
    }
    if (filtros.departamento_id) {
      condiciones.push('e.departamento_id = ?')
      params.push(filtros.departamento_id)
    }
    if (filtros.puesto_id) {
      condiciones.push('e.puesto_id = ?')
      params.push(filtros.puesto_id)
    }
    if (limpiar(filtros.q)) {
      const like = `%${limpiar(filtros.q)}%`
      condiciones.push(`(e.nombre LIKE ? OR e.apellido_paterno LIKE ? OR e.apellido_materno LIKE ?
                         OR e.numero_empleado LIKE ? OR e.curp LIKE ? OR e.rfc LIKE ?)`)
      params.push(like, like, like, like, like, like)
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
    const filas = db.prepare(
      `SELECT e.*, d.nombre AS departamento, p.nombre AS puesto,
              (j.nombre || ' ' || j.apellido_paterno) AS jefe
       FROM empleados e
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       LEFT JOIN puestos p ON p.id = e.puesto_id
       LEFT JOIN empleados j ON j.id = e.jefe_id
       ${where}
       ORDER BY e.apellido_paterno, e.apellido_materno, e.nombre`
    ).all(...params)

    return filas.map((e) => ({
      ...e,
      nombre_completo: nombreCompleto(e),
      antiguedad: antiguedad(e.fecha_ingreso).texto
    }))
  })

  ipcMain.handle('empleados:obtener', (event, id) => {
    const db = getDb()
    const e = db.prepare(
      `SELECT e.*, d.nombre AS departamento, p.nombre AS puesto,
              (j.nombre || ' ' || j.apellido_paterno) AS jefe
       FROM empleados e
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       LEFT JOIN puestos p ON p.id = e.puesto_id
       LEFT JOIN empleados j ON j.id = e.jefe_id
       WHERE e.id = ?`
    ).get(id)
    if (!e) return null

    const baja = db.prepare('SELECT * FROM bajas WHERE empleado_id = ? ORDER BY fecha_baja DESC LIMIT 1').get(id)
    const alDia = e.estatus === 'baja' && baja ? baja.fecha_baja : hoy()

    return {
      ...e,
      nombre_completo: nombreCompleto(e),
      antiguedad: antiguedad(e.fecha_ingreso, alDia),
      edad: e.fecha_nacimiento ? edad(e.fecha_nacimiento) : null,
      vacaciones: saldoDeVacaciones(db, e, alDia),
      baja
    }
  })

  ipcMain.handle('empleados:crear', (event, data) => {
    const db = getDb()
    const error = validar(data)
    if (error) return { ok: false, mensaje: error }

    const ctx = contexto(db)
    const valores = prepararValores(db, data, ctx)

    if (valores.numero_empleado &&
        db.prepare('SELECT id FROM empleados WHERE numero_empleado = ?').get(valores.numero_empleado)) {
      return { ok: false, mensaje: 'Ya existe un empleado con ese número' }
    }
    if (!valores.numero_empleado) valores.numero_empleado = siguienteNumero(db)

    const columnas = CAMPOS.join(', ')
    const marcadores = CAMPOS.map(() => '?').join(', ')
    const info = db.prepare(`INSERT INTO empleados (${columnas}) VALUES (${marcadores})`)
      .run(...CAMPOS.map((c) => valores[c]))

    registrarMovimiento(db, {
      empleado_id: info.lastInsertRowid,
      tipo: 'ingreso',
      fecha: valores.fecha_ingreso,
      nuevo: valores.salario_diario.toString(),
      nota: 'Alta del empleado',
      usuario_id: data.usuario_id
    })

    return { ok: true, id: Number(info.lastInsertRowid) }
  })

  ipcMain.handle('empleados:actualizar', (event, { id, data }) => {
    const db = getDb()
    const error = validar(data)
    if (error) return { ok: false, mensaje: error }

    const previo = db.prepare('SELECT * FROM empleados WHERE id = ?').get(id)
    if (!previo) return { ok: false, mensaje: 'Empleado no encontrado' }
    if (num(data.jefe_id) === Number(id)) return { ok: false, mensaje: 'Un empleado no puede ser su propio jefe' }

    const ctx = contexto(db)
    const valores = prepararValores(db, data, ctx)

    if (valores.numero_empleado) {
      const repetido = db.prepare('SELECT id FROM empleados WHERE numero_empleado = ? AND id <> ?')
        .get(valores.numero_empleado, id)
      if (repetido) return { ok: false, mensaje: 'Ya existe otro empleado con ese número' }
    }

    const sets = CAMPOS.map((c) => `${c} = ?`).join(', ')
    db.prepare(`UPDATE empleados SET ${sets} WHERE id = ?`).run(...CAMPOS.map((c) => valores[c]), id)

    // Los cambios que importan para el expediente quedan en el historial laboral.
    if (round2(previo.salario_diario) !== valores.salario_diario) {
      registrarMovimiento(db, {
        empleado_id: id,
        tipo: 'cambio_salario',
        anterior: String(previo.salario_diario),
        nuevo: String(valores.salario_diario),
        nota: 'Cambio de salario diario',
        usuario_id: data.usuario_id
      })
    }
    if ((previo.puesto_id || null) !== (valores.puesto_id || null)) {
      registrarMovimiento(db, {
        empleado_id: id,
        tipo: 'cambio_puesto',
        anterior: nombrePuesto(db, previo.puesto_id),
        nuevo: nombrePuesto(db, valores.puesto_id),
        usuario_id: data.usuario_id
      })
    }
    if ((previo.departamento_id || null) !== (valores.departamento_id || null)) {
      registrarMovimiento(db, {
        empleado_id: id,
        tipo: 'cambio_departamento',
        anterior: nombreDepartamento(db, previo.departamento_id),
        nuevo: nombreDepartamento(db, valores.departamento_id),
        usuario_id: data.usuario_id
      })
    }
    // Corregir la fecha de ingreso mueve antiguedad, vacaciones y finiquito: no puede
    // pasar sin dejar rastro en el expediente.
    if (previo.fecha_ingreso !== valores.fecha_ingreso) {
      registrarMovimiento(db, {
        empleado_id: id,
        tipo: 'cambio_fecha_ingreso',
        anterior: previo.fecha_ingreso,
        nuevo: valores.fecha_ingreso,
        nota: 'Se recalculan antigüedad, vacaciones y salario diario integrado',
        usuario_id: data.usuario_id
      })
    }

    return { ok: true }
  })

  // --- Bajas ---

  ipcMain.handle('empleados:previewFiniquito', (event, { id, fecha_baja, dias_salarios }) => {
    const db = getDb()
    const empleado = db.prepare('SELECT * FROM empleados WHERE id = ?').get(id)
    if (!empleado) return { ok: false, mensaje: 'Empleado no encontrado' }

    const { cfg, tabla } = contexto(db)
    const fechaBaja = fecha_baja || hoy()
    const saldo = saldoDeVacaciones(db, empleado, fechaBaja)
    const calculo = calcularFiniquito({
      salarioDiario: empleado.salario_diario,
      fechaIngreso: empleado.fecha_ingreso,
      fechaBaja,
      tabla,
      diasAguinaldo: cfg.dias_aguinaldo,
      primaVacacional: cfg.prima_vacacional,
      // Al terminar la relacion si se paga el proporcional del anio en curso (art. 79 LFT).
      diasVacacionesPendientes: Math.max(0, saldo.porFiniquito),
      diasSalariosPendientes: num(dias_salarios)
    })

    return { ok: true, calculo, saldo, antiguedad: antiguedad(empleado.fecha_ingreso, fechaBaja) }
  })

  ipcMain.handle('empleados:darDeBaja', (event, data) => {
    const db = getDb()
    const empleado = db.prepare('SELECT * FROM empleados WHERE id = ?').get(data.empleado_id)
    if (!empleado) return { ok: false, mensaje: 'Empleado no encontrado' }
    if (empleado.estatus === 'baja') return { ok: false, mensaje: 'El empleado ya está dado de baja' }
    if (!data.fecha_baja) return { ok: false, mensaje: 'Selecciona la fecha de baja' }
    if (String(data.fecha_baja) < String(empleado.fecha_ingreso)) {
      return { ok: false, mensaje: 'La fecha de baja no puede ser anterior al ingreso' }
    }
    if (!limpiar(data.motivo)) return { ok: false, mensaje: 'Selecciona el motivo de la baja' }

    const total = round2(
      num(data.monto_vacaciones) + num(data.monto_prima_vacacional) + num(data.monto_aguinaldo) +
      num(data.monto_salarios) + num(data.otras_percepciones) - num(data.deducciones)
    )

    db.exec('BEGIN')
    try {
      db.prepare(
        `INSERT INTO bajas (empleado_id, fecha_baja, motivo, descripcion, dias_vacaciones,
                            monto_vacaciones, monto_prima_vacacional, monto_aguinaldo, monto_salarios,
                            otras_percepciones, deducciones, total_finiquito, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        data.empleado_id, data.fecha_baja, data.motivo, oNulo(data.descripcion),
        num(data.dias_vacaciones), num(data.monto_vacaciones), num(data.monto_prima_vacacional),
        num(data.monto_aguinaldo), num(data.monto_salarios), num(data.otras_percepciones),
        num(data.deducciones), total, data.usuario_id || null
      )
      db.prepare("UPDATE empleados SET estatus = 'baja' WHERE id = ?").run(data.empleado_id)
      registrarMovimiento(db, {
        empleado_id: data.empleado_id,
        tipo: 'baja',
        fecha: data.fecha_baja,
        nuevo: data.motivo,
        nota: limpiar(data.descripcion) || null,
        usuario_id: data.usuario_id
      })
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      return { ok: false, mensaje: `No se pudo registrar la baja: ${e.message}` }
    }

    return { ok: true, total }
  })

  ipcMain.handle('empleados:reingresar', (event, { id, fecha_ingreso, usuario_id }) => {
    const db = getDb()
    const empleado = db.prepare('SELECT * FROM empleados WHERE id = ?').get(id)
    if (!empleado) return { ok: false, mensaje: 'Empleado no encontrado' }
    if (empleado.estatus !== 'baja') return { ok: false, mensaje: 'El empleado ya está activo' }
    if (!fecha_ingreso) return { ok: false, mensaje: 'Selecciona la fecha de reingreso' }

    db.exec('BEGIN')
    try {
      db.prepare("UPDATE empleados SET estatus = 'activo', fecha_ingreso = ? WHERE id = ?")
        .run(fecha_ingreso, id)
      registrarMovimiento(db, {
        empleado_id: id,
        tipo: 'reingreso',
        fecha: fecha_ingreso,
        anterior: empleado.fecha_ingreso,
        nuevo: fecha_ingreso,
        nota: 'La antigüedad se recalcula desde el reingreso',
        usuario_id
      })
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      return { ok: false, mensaje: 'No se pudo registrar el reingreso' }
    }
    return { ok: true }
  })

  ipcMain.handle('empleados:bajas', (event, { desde, hasta } = {}) => {
    const db = getDb()
    const condiciones = []
    const params = []
    if (desde) {
      condiciones.push('b.fecha_baja >= ?')
      params.push(desde)
    }
    if (hasta) {
      condiciones.push('b.fecha_baja <= ?')
      params.push(hasta)
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
    return db.prepare(
      `SELECT b.*, e.nombre, e.apellido_paterno, e.apellido_materno, e.numero_empleado,
              e.fecha_ingreso, d.nombre AS departamento, p.nombre AS puesto
       FROM bajas b
       JOIN empleados e ON e.id = b.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       LEFT JOIN puestos p ON p.id = e.puesto_id
       ${where} ORDER BY b.fecha_baja DESC`
    ).all(...params).map((b) => ({
      ...b,
      nombre_completo: nombreCompleto(b),
      antiguedad: antiguedad(b.fecha_ingreso, b.fecha_baja).texto
    }))
  })

  // --- Historial y organigrama ---

  ipcMain.handle('empleados:movimientos', (event, empleado_id) => {
    return getDb().prepare(
      `SELECT m.*, u.nombre AS usuario
       FROM movimientos m
       LEFT JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.empleado_id = ? ORDER BY m.fecha DESC, m.id DESC`
    ).all(empleado_id)
  })

  ipcMain.handle('empleados:organigrama', () => {
    const db = getDb()
    const filas = db.prepare(
      `SELECT e.id, e.nombre, e.apellido_paterno, e.apellido_materno, e.jefe_id, e.foto,
              p.nombre AS puesto, d.nombre AS departamento
       FROM empleados e
       LEFT JOIN puestos p ON p.id = e.puesto_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       WHERE e.estatus = 'activo'
       ORDER BY e.apellido_paterno, e.nombre`
    ).all()

    const porId = new Map(filas.map((f) => [f.id, { ...f, nombre_completo: nombreCompleto(f), hijos: [] }]))
    const raices = []
    for (const nodo of porId.values()) {
      const padre = nodo.jefe_id ? porId.get(nodo.jefe_id) : null
      if (padre) padre.hijos.push(nodo)
      else raices.push(nodo)
    }
    return raices
  })

  ipcMain.handle('empleados:seleccionarFoto', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Selecciona la foto del empleado',
      filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return { ok: false, canceled: true }

    const archivo = filePaths[0]
    const tamano = fs.statSync(archivo).size
    if (tamano > 2 * 1024 * 1024) {
      return { ok: false, mensaje: 'La foto no debe pasar de 2 MB' }
    }
    const ext = path.extname(archivo).slice(1).toLowerCase()
    const mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`
    return { ok: true, dataUrl: `data:${mime};base64,${fs.readFileSync(archivo).toString('base64')}` }
  })

  ipcMain.handle('empleados:siguienteNumero', () => siguienteNumero(getDb()))
}

function nombreCompleto(e) {
  return [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' ')
}

function nombrePuesto(db, id) {
  if (!id) return null
  return db.prepare('SELECT nombre FROM puestos WHERE id = ?').get(id)?.nombre || null
}

function nombreDepartamento(db, id) {
  if (!id) return null
  return db.prepare('SELECT nombre FROM departamentos WHERE id = ?').get(id)?.nombre || null
}

// Numeros consecutivos tipo EMP-0001 respetando los que ya se hayan capturado a mano.
function siguienteNumero(db) {
  const filas = db.prepare("SELECT numero_empleado FROM empleados WHERE numero_empleado LIKE 'EMP-%'").all()
  const maximo = filas.reduce((max, f) => {
    const n = parseInt(String(f.numero_empleado).replace('EMP-', ''), 10)
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `EMP-${String(maximo + 1).padStart(4, '0')}`
}

export { nombreCompleto }
