import { round2, antiguedad, diasEntre, fecha, aIso, sumarDias } from './utils'

// Calculos laborales con base en la Ley Federal del Trabajo y la Ley del Seguro Social.
// Todos los parametros variables (tabla de vacaciones, dias de aguinaldo, prima
// vacacional, UMA, tarifa del ISR y subsidio) viven en la base y se editan en Ajustes,
// porque cambian con las reformas y con la politica interna de cada empresa.

export function diasVacacionesPorAnio(anio, tabla) {
  if (!anio || anio < 1) return 0
  const filas = [...tabla].sort((a, b) => b.anio - a.anio)
  const fila = filas.find((f) => anio >= f.anio)
  return fila ? fila.dias : 0
}

// Derecho de vacaciones acumulado: los anios de antiguedad ya cumplidos se suman
// completos y el anio en curso se devuelve aparte como proporcional.
export function derechoVacaciones(fechaIngreso, tabla, alDia) {
  const ant = antiguedad(fechaIngreso, alDia)
  let generados = 0
  for (let a = 1; a <= ant.anios; a++) generados += diasVacacionesPorAnio(a, tabla)

  const ingreso = fecha(fechaIngreso)
  let proporcional = 0
  let diasDelAnioEnCurso = 0
  if (ingreso) {
    const ultimoAniversario = new Date(ingreso)
    ultimoAniversario.setFullYear(ingreso.getFullYear() + ant.anios)
    const transcurridos = Math.max(0, diasEntre(aIso(ultimoAniversario), alDia) - 1)
    diasDelAnioEnCurso = diasVacacionesPorAnio(ant.anios + 1, tabla)
    proporcional = round2((diasDelAnioEnCurso * transcurridos) / 365)
  }

  return {
    anios: ant.anios,
    antiguedad: ant.texto,
    diasDelAnioEnCurso,
    generados,
    proporcional,
    total: round2(generados + proporcional)
  }
}

export function saldoVacaciones({ fechaIngreso, tabla, diasTomados = 0, ajustes = 0, alDia }) {
  const derecho = derechoVacaciones(fechaIngreso, tabla, alDia)
  return {
    ...derecho,
    tomados: round2(diasTomados),
    ajustes: round2(ajustes),
    disponibles: round2(derecho.total + ajustes - diasTomados)
  }
}

// Factor de integracion del SBC (art. 27 LSS): 365 dias + aguinaldo + prima vacacional.
// No se redondea: a dos decimales varias antiguedades caen en el mismo factor y el SDI
// sale desviado. El redondeo se hace hasta el salario ya integrado.
export function factorIntegracion({ anios, tabla, diasAguinaldo, primaVacacional }) {
  const diasVac = diasVacacionesPorAnio(Math.max(1, anios || 1), tabla)
  const primaDias = (diasVac * Number(primaVacacional)) / 100
  return (365 + Number(diasAguinaldo) + primaDias) / 365
}

export function salarioDiarioIntegrado({ salarioDiario, anios, tabla, diasAguinaldo, primaVacacional }) {
  return round2(Number(salarioDiario) * factorIntegracion({ anios, tabla, diasAguinaldo, primaVacacional }))
}

// Aguinaldo proporcional a los dias trabajados dentro del anio natural (art. 87 LFT).
export function aguinaldoProporcional({ salarioDiario, diasAguinaldo, fechaIngreso, anio, alDia }) {
  const inicioAnio = `${anio}-01-01`
  const finAnio = `${anio}-12-31`
  const desde = String(fechaIngreso) > inicioAnio ? String(fechaIngreso) : inicioAnio
  const hasta = String(alDia) < finAnio ? String(alDia) : finAnio
  if (desde > hasta) return { dias: 0, diasTrabajados: 0, monto: 0 }

  const diasTrabajados = diasEntre(desde, hasta)
  const dias = round2((Number(diasAguinaldo) * diasTrabajados) / 365)
  return { dias, diasTrabajados, monto: round2(dias * Number(salarioDiario)) }
}

// Finiquito: lo que se debe al terminar la relacion laboral sin importar el motivo.
// La indemnizacion por despido injustificado (3 meses + 20 dias por anio) se captura
// aparte en "otras percepciones" porque depende de como se haya dado la separacion.
export function calcularFiniquito({
  salarioDiario,
  fechaIngreso,
  fechaBaja,
  tabla,
  diasAguinaldo,
  primaVacacional,
  diasVacacionesPendientes,
  diasSalariosPendientes = 0
}) {
  const sd = Number(salarioDiario) || 0
  const anio = Number(String(fechaBaja).slice(0, 4))

  const montoVacaciones = round2(sd * Number(diasVacacionesPendientes || 0))
  const montoPrima = round2((montoVacaciones * Number(primaVacacional)) / 100)
  const aguinaldo = aguinaldoProporcional({
    salarioDiario: sd,
    diasAguinaldo,
    fechaIngreso,
    anio,
    alDia: fechaBaja
  })
  const montoSalarios = round2(sd * Number(diasSalariosPendientes || 0))

  return {
    dias_vacaciones: round2(Number(diasVacacionesPendientes || 0)),
    monto_vacaciones: montoVacaciones,
    monto_prima_vacacional: montoPrima,
    dias_aguinaldo: aguinaldo.dias,
    monto_aguinaldo: aguinaldo.monto,
    monto_salarios: montoSalarios,
    total: round2(montoVacaciones + montoPrima + aguinaldo.monto + montoSalarios)
  }
}

// ISR del periodo: se lleva la base a su equivalente mensual, se aplica la tarifa del
// art. 96 y el resultado se regresa a la proporcion de dias del periodo.
export function calcularIsr({ baseGravable, diasPeriodo, tarifa, subsidioMensual = 0, subsidioTope = 0 }) {
  const base = Number(baseGravable) || 0
  const dias = Number(diasPeriodo) || 30
  if (base <= 0) return { isr: 0, subsidio: 0, retencion: 0, baseMensual: 0 }

  const baseMensual = round2((base / dias) * 30.4)
  const filas = [...tarifa].sort((a, b) => a.limite_inferior - b.limite_inferior)
  const fila =
    [...filas].reverse().find((f) => baseMensual >= f.limite_inferior) || filas[0]

  const excedente = Math.max(0, baseMensual - fila.limite_inferior)
  const isrMensual = round2(fila.cuota_fija + (excedente * fila.porcentaje) / 100)
  const subsidioAplica = subsidioTope > 0 && baseMensual <= Number(subsidioTope)
  const subsidioMes = subsidioAplica ? Number(subsidioMensual) : 0

  const isr = round2((isrMensual / 30.4) * dias)
  const subsidio = round2((subsidioMes / 30.4) * dias)

  return {
    baseMensual,
    isr,
    subsidio,
    retencion: round2(Math.max(0, isr - subsidio))
  }
}

// Cuotas obrero-patronales a cargo del trabajador (arts. 25, 106, 107, 147 y 168 LSS).
export function cuotaObreroImss({ sbc, dias, uma }) {
  const s = Number(sbc) || 0
  const d = Number(dias) || 0
  const u = Number(uma) || 0
  if (s <= 0 || d <= 0) return { total: 0, detalle: {} }

  const excedente = s > u * 3 ? round2((s - u * 3) * 0.004 * d) : 0
  const prestacionesDinero = round2(s * 0.0025 * d)
  const gastosMedicos = round2(s * 0.00375 * d)
  const invalidezVida = round2(s * 0.00625 * d)
  const cesantiaVejez = round2(s * 0.01125 * d)

  return {
    detalle: { excedente, prestacionesDinero, gastosMedicos, invalidezVida, cesantiaVejez },
    total: round2(excedente + prestacionesDinero + gastosMedicos + invalidezVida + cesantiaVejez)
  }
}

// Horas extra: las primeras 9 de la semana se pagan dobles y el resto triple (art. 68 LFT).
export function montoHorasExtra({ salarioDiario, horas, horasPorJornada = 8 }) {
  const sd = Number(salarioDiario) || 0
  const h = Number(horas) || 0
  if (sd <= 0 || h <= 0) return 0
  const porHora = sd / horasPorJornada
  const dobles = Math.min(h, 9)
  const triples = Math.max(0, h - 9)
  return round2(porHora * dobles * 2 + porHora * triples * 3)
}

// Fecha en la que el trabajador cumple su siguiente aniversario laboral.
export function proximoAniversarioLaboral(fechaIngreso, alDia) {
  const ant = antiguedad(fechaIngreso, alDia)
  const ingreso = fecha(fechaIngreso)
  if (!ingreso) return null
  const siguiente = new Date(ingreso)
  siguiente.setFullYear(ingreso.getFullYear() + ant.anios + 1)
  return aIso(siguiente)
}

// Los periodos de vacaciones prescriben a los 18 meses de cumplido el anio (art. 81 LFT).
export function vencimientoPeriodo(fechaIngreso, anioAntiguedad) {
  const ingreso = fecha(fechaIngreso)
  if (!ingreso) return null
  const cumple = new Date(ingreso)
  cumple.setFullYear(ingreso.getFullYear() + Number(anioAntiguedad))
  return sumarDias(aIso(cumple), 548)
}
