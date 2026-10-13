import { dialog } from 'electron'
import * as XLSX from 'xlsx'
import bancos from '../data/bancos.json'
import { insertarEmpleado } from './empleados'

// [encabezado del layout, ejemplo, indicacion]
const COLUMNAS = [
  ['numero_empleado', '', 'Opcional. Si se deja vacío se asigna EMP-0001, EMP-0002…'],
  ['nombre', 'Juan', 'Obligatorio'],
  ['apellido_paterno', 'Pérez', 'Obligatorio'],
  ['apellido_materno', 'López', 'Opcional'],
  ['fecha_nacimiento', '1990-05-23', 'Fecha AAAA-MM-DD o DD/MM/AAAA'],
  ['genero', 'masculino', 'femenino, masculino u otro'],
  ['estado_civil', 'soltero', 'soltero, casado, union_libre, divorciado o viudo'],
  ['curp', '', '18 caracteres'],
  ['rfc', '', '12 o 13 caracteres'],
  ['nss', '', '11 dígitos'],
  ['telefono', '', 'Opcional'],
  ['correo', '', 'Opcional'],
  ['direccion', '', 'Opcional'],
  ['ciudad', '', 'Opcional'],
  ['estado', '', 'Opcional'],
  ['cp', '', '5 dígitos'],
  ['contacto_emergencia', '', 'Opcional'],
  ['telefono_emergencia', '', 'Opcional'],
  ['departamento', '', 'Nombre exacto de un departamento ya dado de alta en Catálogos (ver hoja "Departamentos y puestos")'],
  ['puesto', '', 'Nombre exacto de un puesto ya dado de alta en Catálogos'],
  ['jefe_numero_empleado', '', 'Número de empleado del jefe directo (debe existir ya)'],
  ['fecha_ingreso', '2026-01-15', 'Obligatorio. AAAA-MM-DD o DD/MM/AAAA'],
  ['tipo_contrato', 'indeterminado', 'indeterminado, determinado, prueba, capacitacion u honorarios'],
  ['fecha_fin_contrato', '', 'Obligatoria si el contrato es determinado'],
  ['tipo_jornada', 'diurna', 'diurna, nocturna, mixta o reducida'],
  ['hora_entrada', '09:00', 'HH:MM'],
  ['hora_salida', '18:00', 'HH:MM'],
  ['dias_descanso', 'Sáb,Dom', 'Días que NO trabaja: Dom, Lun, Mar, Mié, Jue, Vie, Sáb (separados por coma)'],
  ['salario_diario', '350.00', 'Captura el diario o el mensual (el otro se calcula a 30 días)'],
  ['salario_mensual', '', 'Captura el diario o el mensual'],
  ['banco', 'BBVA BANCOMER', 'Nombre tal como aparece en la hoja "Bancos"'],
  ['clabe', '', 'Solo números, máximo 18'],
  ['notas', '', 'Opcional']
]

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']

function normalizar(v) {
  return String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function vacio(v) {
  return v === '' || v === null || v === undefined
}

// Acepta AAAA-MM-DD, DD/MM/AAAA, Date o numero de serie de Excel. null = no valida.
function leerFecha(v) {
  if (vacio(v)) return ''
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null
  }
  const t = String(v).trim()
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

function leerHora(v) {
  if (vacio(v)) return ''
  if (v instanceof Date) {
    return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`
  }
  if (typeof v === 'number') {
    const minutos = Math.round((v % 1) * 24 * 60)
    return `${String(Math.floor(minutos / 60) % 24).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
  }
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

function leerDescansos(v) {
  if (vacio(v)) return '0'
  const idx = []
  for (const parte of String(v).split(/[,;\s]+/).filter(Boolean)) {
    const i = DIAS_SEMANA.indexOf(normalizar(parte).slice(0, 3))
    if (i < 0) return null
    if (!idx.includes(i)) idx.push(i)
  }
  return idx.sort().join(',')
}

function filaAEmpleado(db, fila) {
  const texto = (k) => (vacio(fila[k]) ? '' : String(fila[k]).trim())
  const errores = []
  const data = {}

  for (const c of ['numero_empleado', 'nombre', 'apellido_paterno', 'apellido_materno', 'nss', 'telefono',
    'correo', 'direccion', 'ciudad', 'estado', 'cp', 'contacto_emergencia', 'telefono_emergencia', 'notas']) {
    data[c] = texto(c)
  }
  data.curp = texto('curp').toUpperCase()
  data.rfc = texto('rfc').toUpperCase()

  for (const c of ['fecha_nacimiento', 'fecha_ingreso', 'fecha_fin_contrato']) {
    const f = leerFecha(fila[c])
    if (f === null) errores.push(`${c}: fecha no válida`)
    data[c] = f || ''
  }
  for (const c of ['hora_entrada', 'hora_salida']) {
    const h = leerHora(fila[c])
    if (h === null) errores.push(`${c}: hora no válida (HH:MM)`)
    data[c] = h || (c === 'hora_entrada' ? '09:00' : '18:00')
  }

  const opcion = (campo, validas, porDefecto) => {
    const v = normalizar(fila[campo]).replace(/\s+/g, '_')
    if (!v) return porDefecto
    if (!validas.includes(v)) {
      errores.push(`${campo}: valor no válido (${validas.join(', ')})`)
      return porDefecto
    }
    return v
  }
  data.genero = opcion('genero', ['femenino', 'masculino', 'otro'], null)
  data.estado_civil = opcion('estado_civil', ['soltero', 'casado', 'union_libre', 'divorciado', 'viudo'], null)
  data.tipo_contrato = opcion('tipo_contrato', ['indeterminado', 'determinado', 'prueba', 'capacitacion', 'honorarios'], 'indeterminado')
  data.tipo_jornada = opcion('tipo_jornada', ['diurna', 'nocturna', 'mixta', 'reducida'], 'diurna')

  const descansos = leerDescansos(fila.dias_descanso)
  if (descansos === null) errores.push('dias_descanso: usa Dom, Lun, Mar, Mié, Jue, Vie, Sáb')
  data.dias_descanso = descansos ?? '0'

  for (const c of ['salario_diario', 'salario_mensual']) {
    const t = texto(c).replace(/[$,\s]/g, '')
    const n = t === '' ? 0 : Number(t)
    if (!Number.isFinite(n) || n < 0) errores.push(`${c}: número no válido`)
    data[c] = Number.isFinite(n) ? n : 0
  }

  const clabe = texto('clabe').replace(/\s/g, '')
  if (clabe && !/^\d{1,18}$/.test(clabe)) errores.push('clabe: solo números, máximo 18')
  data.clabe = clabe

  const banco = texto('banco')
  data.banco = ''
  if (banco) {
    const hallado = bancos.find((b) => normalizar(b.nombre) === normalizar(banco))
    if (hallado) data.banco = hallado.nombre
    else errores.push(`banco: "${banco}" no está en el catálogo (ver hoja "Bancos")`)
  }

  const depto = texto('departamento')
  data.departamento_id = null
  if (depto) {
    const d = db.prepare('SELECT id FROM departamentos WHERE activo = 1 AND lower(nombre) = lower(?)').get(depto)
    if (d) data.departamento_id = d.id
    else errores.push(`departamento: "${depto}" no existe en Catálogos`)
  }
  const puesto = texto('puesto')
  data.puesto_id = null
  if (puesto) {
    const p = data.departamento_id
      ? db.prepare(
        'SELECT id FROM puestos WHERE activo = 1 AND lower(nombre) = lower(?) AND (departamento_id = ? OR departamento_id IS NULL)'
      ).get(puesto, data.departamento_id)
      : db.prepare('SELECT id FROM puestos WHERE activo = 1 AND lower(nombre) = lower(?)').get(puesto)
    if (p) data.puesto_id = p.id
    else errores.push(`puesto: "${puesto}" no existe en Catálogos`)
  }
  const jefe = texto('jefe_numero_empleado')
  data.jefe_id = null
  if (jefe) {
    const j = db.prepare('SELECT id FROM empleados WHERE numero_empleado = ?').get(jefe)
    if (j) data.jefe_id = j.id
    else errores.push(`jefe_numero_empleado: "${jefe}" no existe`)
  }

  return { data, errores }
}

function hojaEmpleados() {
  const encabezados = COLUMNAS.map((c) => c[0])
  const hoja = XLSX.utils.aoa_to_sheet([encabezados, COLUMNAS.map((c) => c[1])])
  hoja['!cols'] = encabezados.map((h) => ({ wch: Math.max(14, h.length + 4) }))
  return hoja
}

export function generarLayout(db, ruta) {
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hojaEmpleados(), 'Empleados')

  const instrucciones = XLSX.utils.aoa_to_sheet([
    ['Columna', 'Indicaciones'],
    ...COLUMNAS.map((c) => [c[0], c[2]]),
    [],
    ['Nota', 'La fila 2 de la hoja "Empleados" es un ejemplo: bórrala o reemplázala antes de importar.']
  ])
  instrucciones['!cols'] = [{ wch: 24 }, { wch: 90 }]
  XLSX.utils.book_append_sheet(libro, instrucciones, 'Instrucciones')

  const filas = db.prepare(
    `SELECT d.nombre AS departamento, p.nombre AS puesto
     FROM departamentos d
     LEFT JOIN puestos p ON p.departamento_id = d.id AND p.activo = 1
     WHERE d.activo = 1 ORDER BY d.nombre, p.nombre`
  ).all()
  const hojaCat = XLSX.utils.json_to_sheet(filas.length ? filas : [{ departamento: '', puesto: '' }])
  hojaCat['!cols'] = [{ wch: 30 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(libro, hojaCat, 'Departamentos y puestos')

  const hojaBancos = XLSX.utils.json_to_sheet(
    bancos.map((b) => ({ banco: b.nombre, codigo: b.codigo, nombre_completo: b.nombre_completo }))
  )
  hojaBancos['!cols'] = [{ wch: 28 }, { wch: 8 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(libro, hojaBancos, 'Bancos')

  XLSX.writeFile(libro, ruta)
}

// Lee el archivo y da de alta las filas validas; las demas se devuelven con su motivo.
export function importarArchivo(db, ruta, usuario_id) {
  let filas
  try {
    const libro = XLSX.readFile(ruta, { cellDates: true })
    const nombreHoja = libro.SheetNames.find((n) => n.toLowerCase() === 'empleados') || libro.SheetNames[0]
    filas = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { defval: '', raw: true })
  } catch (e) {
    return { ok: false, mensaje: `No se pudo leer el archivo: ${e.message}` }
  }
  if (!filas.length) return { ok: false, mensaje: 'El archivo no tiene empleados' }

  const errores = []
  let creados = 0

  db.exec('BEGIN')
  try {
    filas.forEach((original, i) => {
      // Encabezados sin importar mayusculas, acentos ni espacios.
      const fila = {}
      for (const [k, v] of Object.entries(original)) fila[normalizar(k).replace(/\s+/g, '_')] = v
      if (Object.values(fila).every(vacio)) return

      const numFila = i + 2
      const { data, errores: errs } = filaAEmpleado(db, fila)
      if (errs.length) {
        errores.push({ fila: numFila, mensaje: errs.join('; ') })
        return
      }
      const res = insertarEmpleado(db, { ...data, usuario_id })
      if (res.ok) creados += 1
      else errores.push({ fila: numFila, mensaje: res.mensaje })
    })
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    return { ok: false, mensaje: `No se pudo importar: ${e.message}` }
  }

  return { ok: true, creados, errores }
}

export function register(ipcMain, getDb) {
  ipcMain.handle('empleados:descargarLayout', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Guardar layout de empleados',
      defaultPath: 'layout-empleados.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (canceled || !filePath) return { ok: false, canceled: true }

    try {
      generarLayout(getDb(), filePath)
      return { ok: true, ruta: filePath }
    } catch (e) {
      return { ok: false, mensaje: `No se pudo guardar el layout: ${e.message}` }
    }
  })

  ipcMain.handle('empleados:importar', async (event, { usuario_id } = {}) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Selecciona el layout con los empleados',
      filters: [{ name: 'Excel o CSV', extensions: ['xlsx', 'xls', 'csv'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return { ok: false, canceled: true }
    return importarArchivo(getDb(), filePaths[0], usuario_id)
  })
}
