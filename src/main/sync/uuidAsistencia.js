import crypto from 'node:crypto'

// Namespace fijo del uuid v5 de la asistencia. NO lo cambies: el servidor y la app de
// escritorio tienen que calcular exactamente el mismo uuid para el mismo empleado y dia.
const NS_ASISTENCIA = '6f1d2c4e-8a3b-4d57-9c61-3b7a5e2f9d10'

/**
 * Un registro de asistencia por empleado y dia, con id deterministico (uuid v5).
 * Asi la web y la computadora de RH que marcan el mismo dia escriben la MISMA fila y
 * "gana la ultima edicion" decide, en vez de crear dos filas que chocan.
 *
 * @param empleadoUuid uuid del empleado (no su id local)
 * @param fecha        'YYYY-MM-DD'
 */
export function uuidAsistencia(empleadoUuid, fecha) {
  const ns = Buffer.from(NS_ASISTENCIA.replace(/-/g, ''), 'hex')
  const hash = crypto
    .createHash('sha1')
    .update(Buffer.concat([ns, Buffer.from(`${String(empleadoUuid).toLowerCase()}|${fecha}`)]))
    .digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const h = hash.subarray(0, 16).toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
