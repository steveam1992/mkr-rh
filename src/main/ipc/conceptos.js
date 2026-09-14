import { limpiar, oNulo, num, round2 } from '../utils'

// A que renglon del recibo va cada concepto. Los que no tienen renglon propio caen en
// "otras percepciones" / "otras deducciones", pero igual se detallan en el recibo.
export const DESTINO = {
  bono: 'bonos',
  puntualidad: 'bonos',
  asistencia: 'bonos',
  productividad: 'bonos',
  comision: 'bonos',
  despensa: 'otras_percepciones',
  transporte: 'otras_percepciones',
  otra_percepcion: 'otras_percepciones',
  infonavit: 'infonavit',
  fonacot: 'fonacot',
  prestamo: 'prestamos',
  caja_ahorro: 'otras_deducciones',
  pension_alimenticia: 'otras_deducciones',
  sindicato: 'otras_deducciones',
  otra_deduccion: 'otras_deducciones'
}

const PERCEPCIONES = ['bono', 'puntualidad', 'asistencia', 'productividad', 'comision', 'despensa', 'transporte', 'otra_percepcion']
const CON_CREDITO = ['infonavit', 'fonacot', 'prestamo']

function tipoDe(clave) {
  return PERCEPCIONES.includes(clave) ? 'percepcion' : 'deduccion'
}

// Lo aplicado hasta hoy y lo que falta. El saldo se deriva, nunca se guarda.
export function conSaldo(db, concepto) {
  const aplicado = db.prepare(
    'SELECT COALESCE(SUM(importe), 0) AS total FROM concepto_aplicaciones WHERE concepto_id = ?'
  ).get(concepto.id).total

  const tieneCredito = num(concepto.total_credito) > 0
  return {
    ...concepto,
    gravable: !!concepto.gravable,
    activo: !!concepto.activo,
    aplicado: round2(aplicado),
    saldo: tieneCredito ? round2(Math.max(0, num(concepto.total_credito) - aplicado)) : null,
    liquidado: tieneCredito && aplicado >= num(concepto.total_credito) - 0.005
  }
}

// Conceptos vigentes de un empleado para un periodo dado.
export function vigentesPara(db, empleado_id, { fecha_inicio, fecha_fin }) {
  return db.prepare(
    `SELECT * FROM conceptos_empleado
     WHERE empleado_id = ? AND activo = 1
       AND (fecha_inicio IS NULL OR fecha_inicio <= ?)
       AND (fecha_fin IS NULL OR fecha_fin >= ?)
     ORDER BY tipo, clave`
  ).all(empleado_id, fecha_fin, fecha_inicio).map((c) => conSaldo(db, c))
}

// Importe que le toca a un concepto en un periodo, ya topado al saldo del credito.
export function importeDe(concepto, { sueldoPeriodo, saldoDisponible }) {
  const base = concepto.calculo === 'porcentaje'
    ? (num(sueldoPeriodo) * num(concepto.monto)) / 100
    : num(concepto.monto)

  let importe = round2(Math.max(0, base))
  if (saldoDisponible !== null && saldoDisponible !== undefined) {
    importe = round2(Math.min(importe, Math.max(0, saldoDisponible)))
  }
  return importe
}

function validar(db, data) {
  if (!data.empleado_id) return 'Selecciona al empleado'
  if (!db.prepare('SELECT id FROM empleados WHERE id = ?').get(data.empleado_id)) {
    return 'Empleado no encontrado'
  }
  if (!DESTINO[data.clave]) return 'Selecciona el tipo de concepto'
  if (num(data.monto) <= 0) return 'El importe debe ser mayor a 0'
  if (data.calculo === 'porcentaje' && num(data.monto) > 100) {
    return 'El porcentaje no puede ser mayor a 100'
  }
  if (data.fecha_inicio && data.fecha_fin && data.fecha_fin < data.fecha_inicio) {
    return 'La fecha de fin no puede ser anterior al inicio'
  }
  if (CON_CREDITO.includes(data.clave) && num(data.total_credito) < 0) {
    return 'El monto total del crédito no puede ser negativo'
  }
  return null
}

export function register(ipcMain, getDb) {
  ipcMain.handle('conceptos:listar', (event, { empleado_id, incluirInactivos } = {}) => {
    const db = getDb()
    const condiciones = ['empleado_id = ?']
    const params = [empleado_id]
    if (!incluirInactivos) condiciones.push('activo = 1')

    return db.prepare(
      `SELECT * FROM conceptos_empleado WHERE ${condiciones.join(' AND ')} ORDER BY tipo, clave`
    ).all(...params).map((c) => conSaldo(db, c))
  })

  ipcMain.handle('conceptos:crear', (event, data) => {
    const db = getDb()
    const error = validar(db, data)
    if (error) return { ok: false, mensaje: error }

    const info = db.prepare(
      `INSERT INTO conceptos_empleado (empleado_id, tipo, clave, descripcion, calculo, monto,
                                       gravable, numero_credito, total_credito, fecha_inicio,
                                       fecha_fin, notas, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.empleado_id, tipoDe(data.clave), data.clave, oNulo(data.descripcion),
      data.calculo === 'porcentaje' ? 'porcentaje' : 'fijo', num(data.monto),
      data.gravable === false ? 0 : 1, oNulo(data.numero_credito), num(data.total_credito),
      oNulo(data.fecha_inicio), oNulo(data.fecha_fin), oNulo(data.notas), data.usuario_id || null
    )
    return { ok: true, id: Number(info.lastInsertRowid) }
  })

  ipcMain.handle('conceptos:actualizar', (event, { id, data }) => {
    const db = getDb()
    const previo = db.prepare('SELECT * FROM conceptos_empleado WHERE id = ?').get(id)
    if (!previo) return { ok: false, mensaje: 'Concepto no encontrado' }

    const error = validar(db, { ...data, empleado_id: previo.empleado_id })
    if (error) return { ok: false, mensaje: error }

    db.prepare(
      `UPDATE conceptos_empleado
       SET clave = ?, tipo = ?, descripcion = ?, calculo = ?, monto = ?, gravable = ?,
           numero_credito = ?, total_credito = ?, fecha_inicio = ?, fecha_fin = ?, notas = ?
       WHERE id = ?`
    ).run(
      data.clave, tipoDe(data.clave), oNulo(data.descripcion),
      data.calculo === 'porcentaje' ? 'porcentaje' : 'fijo', num(data.monto),
      data.gravable === false ? 0 : 1, oNulo(data.numero_credito), num(data.total_credito),
      oNulo(data.fecha_inicio), oNulo(data.fecha_fin), oNulo(data.notas), id
    )
    return { ok: true }
  })

  ipcMain.handle('conceptos:toggleActivo', (event, { id, activo }) => {
    getDb().prepare('UPDATE conceptos_empleado SET activo = ? WHERE id = ?').run(activo ? 1 : 0, id)
    return { ok: true }
  })

  ipcMain.handle('conceptos:eliminar', (event, id) => {
    const db = getDb()
    const aplicado = db.prepare(
      'SELECT COUNT(*) AS n FROM concepto_aplicaciones WHERE concepto_id = ?'
    ).get(id).n
    if (aplicado > 0) {
      return {
        ok: false,
        mensaje: `No se puede eliminar: ya se aplicó en ${aplicado} recibo(s). Desactívalo para que deje de descontarse.`
      }
    }
    db.prepare('DELETE FROM conceptos_empleado WHERE id = ?').run(id)
    return { ok: true }
  })

  // Historial de descuentos de un credito, para cotejar contra el estado de cuenta.
  ipcMain.handle('conceptos:aplicaciones', (event, concepto_id) => {
    return getDb().prepare(
      `SELECT a.*, p.nombre AS periodo, p.fecha_inicio, p.fecha_fin, p.estatus
       FROM concepto_aplicaciones a
       JOIN nomina_periodos p ON p.id = a.periodo_id
       WHERE a.concepto_id = ?
       ORDER BY p.fecha_inicio DESC`
    ).all(concepto_id)
  })

  // Lo aplicado a un recibo, desglosado. Alimenta el editor y el PDF del recibo.
  ipcMain.handle('conceptos:delRecibo', (event, recibo_id) => {
    return getDb().prepare(
      `SELECT a.importe, c.clave, c.tipo, c.descripcion, c.numero_credito, c.gravable
       FROM concepto_aplicaciones a
       JOIN conceptos_empleado c ON c.id = a.concepto_id
       WHERE a.recibo_id = ?
       ORDER BY c.tipo, c.clave`
    ).all(recibo_id)
  })

  // Creditos con saldo vivo en toda la plantilla.
  ipcMain.handle('conceptos:creditosActivos', () => {
    const db = getDb()
    const filas = db.prepare(
      `SELECT c.*, (e.nombre || ' ' || e.apellido_paterno || ' ' || COALESCE(e.apellido_materno, '')) AS empleado,
              e.numero_empleado, d.nombre AS departamento
       FROM conceptos_empleado c
       JOIN empleados e ON e.id = c.empleado_id
       LEFT JOIN departamentos d ON d.id = e.departamento_id
       WHERE c.total_credito > 0 AND c.activo = 1 AND e.estatus = 'activo'
       ORDER BY c.clave, e.apellido_paterno`
    ).all()
    return filas.map((c) => conSaldo(db, c)).filter((c) => !c.liquidado)
  })
}

export const ETIQUETA_CONCEPTO = {
  bono: 'Bono',
  puntualidad: 'Bono de puntualidad',
  asistencia: 'Bono de asistencia',
  productividad: 'Bono de productividad',
  comision: 'Comisiones',
  despensa: 'Vales de despensa',
  transporte: 'Ayuda de transporte',
  otra_percepcion: 'Otra percepción',
  infonavit: 'INFONAVIT',
  fonacot: 'FONACOT',
  prestamo: 'Préstamo',
  caja_ahorro: 'Caja de ahorro',
  pension_alimenticia: 'Pensión alimenticia',
  sindicato: 'Cuota sindical',
  otra_deduccion: 'Otra deducción'
}
