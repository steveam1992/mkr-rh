const MS_DIA = 86400000

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

export function hoy() {
  return aIso(new Date())
}

export function aIso(fecha) {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Las fechas se guardan como 'YYYY-MM-DD' y se arman por partes: usar new Date(iso)
// las interpreta como UTC y en Mexico eso corre un dia hacia atras.
export function fecha(iso) {
  if (!iso) return null
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function sumarDias(iso, dias) {
  const f = fecha(iso)
  if (!f) return null
  f.setDate(f.getDate() + Number(dias))
  return aIso(f)
}

// Dias transcurridos entre dos fechas contando ambos extremos.
export function diasEntre(desde, hasta) {
  const a = fecha(desde)
  const b = fecha(hasta)
  if (!a || !b) return 0
  return Math.round((b - a) / MS_DIA) + 1
}

export function antiguedad(fechaIngreso, alDia = hoy()) {
  const ingreso = fecha(fechaIngreso)
  const corte = fecha(alDia)
  if (!ingreso || !corte || corte < ingreso) {
    return { anios: 0, meses: 0, dias: 0, totalDias: 0, texto: '—' }
  }

  let anios = corte.getFullYear() - ingreso.getFullYear()
  let meses = corte.getMonth() - ingreso.getMonth()
  let dias = corte.getDate() - ingreso.getDate()

  if (dias < 0) {
    meses -= 1
    dias += new Date(corte.getFullYear(), corte.getMonth(), 0).getDate()
  }
  if (meses < 0) {
    anios -= 1
    meses += 12
  }

  const totalDias = Math.round((corte - ingreso) / MS_DIA)
  const partes = []
  if (anios) partes.push(`${anios} ${anios === 1 ? 'año' : 'años'}`)
  if (meses) partes.push(`${meses} ${meses === 1 ? 'mes' : 'meses'}`)
  if (!anios && !meses) partes.push(`${dias} ${dias === 1 ? 'día' : 'días'}`)

  return { anios, meses, dias, totalDias, texto: partes.join(', ') }
}

export function edad(fechaNacimiento, alDia = hoy()) {
  return antiguedad(fechaNacimiento, alDia).anios
}

// Fecha del proximo aniversario de la fecha dada (cumpleanos o aniversario laboral).
export function proximoAniversario(iso, desde = hoy()) {
  const base = fecha(iso)
  const ref = fecha(desde)
  if (!base || !ref) return null
  const candidato = new Date(ref.getFullYear(), base.getMonth(), base.getDate())
  if (candidato < ref) candidato.setFullYear(candidato.getFullYear() + 1)
  return aIso(candidato)
}

export function rangosSeSolapan(inicioA, finA, inicioB, finB) {
  return String(inicioA) <= String(finB) && String(inicioB) <= String(finA)
}

export function limpiar(valor) {
  return typeof valor === 'string' ? valor.trim() : ''
}

export function oNulo(valor) {
  const v = limpiar(valor)
  return v === '' ? null : v
}

export function num(valor, porDefecto = 0) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : porDefecto
}

export function primerDiaDelMes(iso = hoy()) {
  return `${String(iso).slice(0, 7)}-01`
}

export function ultimoDiaDelMes(iso = hoy()) {
  const f = fecha(iso)
  return aIso(new Date(f.getFullYear(), f.getMonth() + 1, 0))
}

// Diferencia en horas entre dos horas 'HH:MM' del mismo dia; si la salida es menor
// se asume turno que cruza la medianoche.
export function horasEntre(entrada, salida) {
  if (!entrada || !salida) return 0
  const [he, me] = String(entrada).split(':').map(Number)
  const [hs, ms] = String(salida).split(':').map(Number)
  if ([he, me, hs, ms].some((v) => !Number.isFinite(v))) return 0
  let minutos = hs * 60 + ms - (he * 60 + me)
  if (minutos < 0) minutos += 24 * 60
  return round2(minutos / 60)
}

export function minutosRetardo(horaEsperada, horaReal) {
  if (!horaEsperada || !horaReal) return 0
  const [he, me] = String(horaEsperada).split(':').map(Number)
  const [hr, mr] = String(horaReal).split(':').map(Number)
  if ([he, me, hr, mr].some((v) => !Number.isFinite(v))) return 0
  return Math.max(0, hr * 60 + mr - (he * 60 + me))
}
