import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

let db

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

export function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(password, salt, 64)
  const stored = Buffer.from(hash, 'hex')
  if (check.length !== stored.length) return false
  return crypto.timingSafeEqual(check, stored)
}

export function rutaExpedientes() {
  const dir = path.join(app.getPath('userData'), 'expedientes')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function rutaBase() {
  return path.join(app.getPath('userData'), 'rh.db')
}

export function init() {
  db = new DatabaseSync(rutaBase())
  db.exec('PRAGMA foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'rh',
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      nombre_empresa TEXT NOT NULL DEFAULT 'Mi Empresa',
      razon_social TEXT,
      logo TEXT,
      rfc TEXT,
      registro_patronal TEXT,
      direccion TEXT,
      telefono TEXT,
      correo TEXT,
      dias_aguinaldo REAL NOT NULL DEFAULT 15,
      prima_vacacional REAL NOT NULL DEFAULT 25,
      periodo_nomina TEXT NOT NULL DEFAULT 'quincenal',
      tolerancia_retardo INTEGER NOT NULL DEFAULT 10,
      uma_diaria REAL NOT NULL DEFAULT 113.14,
      subsidio_mensual REAL NOT NULL DEFAULT 475,
      subsidio_tope REAL NOT NULL DEFAULT 10171,
      setup_completado INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vacaciones_tabla (
      anio INTEGER PRIMARY KEY,
      dias INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS isr_tarifa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      limite_inferior REAL NOT NULL,
      limite_superior REAL,
      cuota_fija REAL NOT NULL,
      porcentaje REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dias_festivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL UNIQUE,
      descripcion TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS departamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS puestos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      departamento_id INTEGER REFERENCES departamentos(id),
      descripcion TEXT,
      salario_min REAL NOT NULL DEFAULT 0,
      salario_max REAL NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS empleados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_empleado TEXT UNIQUE,
      nombre TEXT NOT NULL,
      apellido_paterno TEXT NOT NULL,
      apellido_materno TEXT,
      fecha_nacimiento TEXT,
      genero TEXT,
      estado_civil TEXT,
      curp TEXT,
      rfc TEXT,
      nss TEXT,
      telefono TEXT,
      correo TEXT,
      contacto_emergencia TEXT,
      telefono_emergencia TEXT,
      direccion TEXT,
      ciudad TEXT,
      estado TEXT,
      cp TEXT,
      departamento_id INTEGER REFERENCES departamentos(id),
      puesto_id INTEGER REFERENCES puestos(id),
      jefe_id INTEGER REFERENCES empleados(id),
      fecha_ingreso TEXT NOT NULL,
      tipo_contrato TEXT NOT NULL DEFAULT 'indeterminado',
      fecha_fin_contrato TEXT,
      salario_diario REAL NOT NULL DEFAULT 0,
      salario_mensual REAL NOT NULL DEFAULT 0,
      salario_diario_integrado REAL NOT NULL DEFAULT 0,
      tipo_jornada TEXT NOT NULL DEFAULT 'diurna',
      hora_entrada TEXT,
      hora_salida TEXT,
      dias_descanso TEXT,
      banco TEXT,
      clabe TEXT,
      foto TEXT,
      notas TEXT,
      estatus TEXT NOT NULL DEFAULT 'activo',
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS bajas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id),
      fecha_baja TEXT NOT NULL,
      motivo TEXT NOT NULL,
      descripcion TEXT,
      dias_vacaciones REAL NOT NULL DEFAULT 0,
      monto_vacaciones REAL NOT NULL DEFAULT 0,
      monto_prima_vacacional REAL NOT NULL DEFAULT 0,
      monto_aguinaldo REAL NOT NULL DEFAULT 0,
      monto_salarios REAL NOT NULL DEFAULT 0,
      otras_percepciones REAL NOT NULL DEFAULT 0,
      deducciones REAL NOT NULL DEFAULT 0,
      total_finiquito REAL NOT NULL DEFAULT 0,
      usuario_id INTEGER REFERENCES usuarios(id),
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id),
      tipo TEXT NOT NULL,
      fecha TEXT NOT NULL,
      valor_anterior TEXT,
      valor_nuevo TEXT,
      nota TEXT,
      usuario_id INTEGER REFERENCES usuarios(id),
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id),
      tipo TEXT NOT NULL DEFAULT 'otro',
      nombre TEXT NOT NULL,
      archivo TEXT NOT NULL,
      extension TEXT,
      tamano INTEGER NOT NULL DEFAULT 0,
      fecha_emision TEXT,
      fecha_vencimiento TEXT,
      notas TEXT,
      usuario_id INTEGER REFERENCES usuarios(id),
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS vacaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id),
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      dias REAL NOT NULL,
      periodo INTEGER,
      motivo TEXT,
      estatus TEXT NOT NULL DEFAULT 'pendiente',
      comentario TEXT,
      pagar_prima INTEGER NOT NULL DEFAULT 0,
      resuelto_por INTEGER REFERENCES usuarios(id),
      fecha_resolucion TEXT,
      usuario_id INTEGER REFERENCES usuarios(id),
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS vacaciones_ajustes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id),
      dias REAL NOT NULL,
      motivo TEXT,
      usuario_id INTEGER REFERENCES usuarios(id),
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS incapacidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id),
      folio TEXT,
      tipo TEXT NOT NULL DEFAULT 'enfermedad_general',
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      dias INTEGER NOT NULL DEFAULT 0,
      porcentaje_pago REAL NOT NULL DEFAULT 60,
      control TEXT NOT NULL DEFAULT 'inicial',
      notas TEXT,
      usuario_id INTEGER REFERENCES usuarios(id),
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS permisos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id),
      tipo TEXT NOT NULL DEFAULT 'con_goce',
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      dias REAL NOT NULL DEFAULT 1,
      horas REAL NOT NULL DEFAULT 0,
      motivo TEXT,
      estatus TEXT NOT NULL DEFAULT 'pendiente',
      descuenta INTEGER NOT NULL DEFAULT 0,
      comentario TEXT,
      resuelto_por INTEGER REFERENCES usuarios(id),
      fecha_resolucion TEXT,
      usuario_id INTEGER REFERENCES usuarios(id),
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS asistencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id),
      fecha TEXT NOT NULL,
      hora_entrada TEXT,
      hora_salida TEXT,
      horas REAL NOT NULL DEFAULT 0,
      minutos_retardo INTEGER NOT NULL DEFAULT 0,
      horas_extra REAL NOT NULL DEFAULT 0,
      estatus TEXT NOT NULL DEFAULT 'asistencia',
      nota TEXT,
      usuario_id INTEGER REFERENCES usuarios(id),
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE (empleado_id, fecha)
    );

    CREATE TABLE IF NOT EXISTS nomina_periodos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'quincenal',
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      fecha_pago TEXT,
      dias REAL NOT NULL DEFAULT 15,
      estatus TEXT NOT NULL DEFAULT 'abierto',
      total_percepciones REAL NOT NULL DEFAULT 0,
      total_deducciones REAL NOT NULL DEFAULT 0,
      total_neto REAL NOT NULL DEFAULT 0,
      num_empleados INTEGER NOT NULL DEFAULT 0,
      usuario_id INTEGER REFERENCES usuarios(id),
      creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS nomina_recibos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      periodo_id INTEGER NOT NULL REFERENCES nomina_periodos(id) ON DELETE CASCADE,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id),
      dias_trabajados REAL NOT NULL DEFAULT 0,
      dias_falta REAL NOT NULL DEFAULT 0,
      dias_incapacidad REAL NOT NULL DEFAULT 0,
      dias_vacaciones REAL NOT NULL DEFAULT 0,
      salario_diario REAL NOT NULL DEFAULT 0,
      sueldo REAL NOT NULL DEFAULT 0,
      horas_extra REAL NOT NULL DEFAULT 0,
      monto_horas_extra REAL NOT NULL DEFAULT 0,
      prima_vacacional REAL NOT NULL DEFAULT 0,
      aguinaldo REAL NOT NULL DEFAULT 0,
      bonos REAL NOT NULL DEFAULT 0,
      otras_percepciones REAL NOT NULL DEFAULT 0,
      total_percepciones REAL NOT NULL DEFAULT 0,
      isr REAL NOT NULL DEFAULT 0,
      subsidio REAL NOT NULL DEFAULT 0,
      imss REAL NOT NULL DEFAULT 0,
      infonavit REAL NOT NULL DEFAULT 0,
      prestamos REAL NOT NULL DEFAULT 0,
      descuento_faltas REAL NOT NULL DEFAULT 0,
      otras_deducciones REAL NOT NULL DEFAULT 0,
      total_deducciones REAL NOT NULL DEFAULT 0,
      neto REAL NOT NULL DEFAULT 0,
      notas TEXT,
      UNIQUE (periodo_id, empleado_id)
    );

    CREATE INDEX IF NOT EXISTS idx_empleados_estatus ON empleados(estatus);
    CREATE INDEX IF NOT EXISTS idx_documentos_empleado ON documentos(empleado_id);
    CREATE INDEX IF NOT EXISTS idx_vacaciones_empleado ON vacaciones(empleado_id);
    CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON asistencia(fecha);
    CREATE INDEX IF NOT EXISTS idx_recibos_periodo ON nomina_recibos(periodo_id);
  `)

  const instalacionNueva = seedConfiguracion()
  seedTablaVacaciones()
  seedTarifaIsr()
  if (instalacionNueva) seedFestivos()

  rutaExpedientes()
}

// Se conserva para las migraciones de versiones futuras: agrega la columna solo si falta.
export function ensureColumn(tabla, columna, definicion) {
  const cols = db.prepare(`PRAGMA table_info(${tabla})`).all()
  if (cols.some((c) => c.name === columna)) return false
  db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`)
  return true
}

function seedConfiguracion() {
  if (db.prepare('SELECT COUNT(*) AS n FROM configuracion').get().n > 0) return false
  db.prepare('INSERT INTO configuracion (id, nombre_empresa) VALUES (1, ?)').run('Mi Empresa')
  return true
}

// Tabla del articulo 76 de la LFT tras la reforma de 2023: 12 dias el primer anio,
// +2 por anio hasta 20 y despues +2 por cada bloque de 5 anios.
function seedTablaVacaciones() {
  if (db.prepare('SELECT COUNT(*) AS n FROM vacaciones_tabla').get().n > 0) return
  const filas = [
    [1, 12], [2, 14], [3, 16], [4, 18], [5, 20],
    [6, 22], [11, 24], [16, 26], [21, 28], [26, 30], [31, 32]
  ]
  const stmt = db.prepare('INSERT INTO vacaciones_tabla (anio, dias) VALUES (?, ?)')
  for (const [anio, dias] of filas) stmt.run(anio, dias)
}

// Tarifa mensual del ISR (art. 96 LISR). El SAT la actualiza, por eso queda editable
// desde Ajustes: aqui solo se siembra un punto de partida.
function seedTarifaIsr() {
  if (db.prepare('SELECT COUNT(*) AS n FROM isr_tarifa').get().n > 0) return
  const filas = [
    [0.01, 746.04, 0, 1.92],
    [746.05, 6332.05, 14.32, 6.4],
    [6332.06, 11128.01, 371.83, 10.88],
    [11128.02, 12935.82, 893.63, 16],
    [12935.83, 15487.71, 1182.88, 17.92],
    [15487.72, 31236.49, 1640.18, 21.36],
    [31236.5, 49233, 5004.12, 23.52],
    [49233.01, 93993.9, 9236.89, 30],
    [93993.91, 125325.2, 22665.17, 32],
    [125325.21, 375975.61, 32691.18, 34],
    [375975.62, null, 117912.32, 35]
  ]
  const stmt = db.prepare(
    'INSERT INTO isr_tarifa (limite_inferior, limite_superior, cuota_fija, porcentaje) VALUES (?, ?, ?, ?)'
  )
  for (const f of filas) stmt.run(f[0], f[1], f[2], f[3])
}

function seedFestivos() {
  const anio = new Date().getFullYear()
  const filas = [
    ['01-01', 'Año Nuevo'],
    ['02-05', 'Día de la Constitución'],
    ['03-21', 'Natalicio de Benito Juárez'],
    ['05-01', 'Día del Trabajo'],
    ['09-16', 'Independencia de México'],
    ['11-20', 'Revolución Mexicana'],
    ['12-25', 'Navidad']
  ]
  const stmt = db.prepare('INSERT OR IGNORE INTO dias_festivos (fecha, descripcion) VALUES (?, ?)')
  for (const [md, desc] of filas) stmt.run(`${anio}-${md}`, desc)
}

export function getDb() {
  return db
}

export function cerrar() {
  try {
    db?.close()
  } catch (e) {
    // la base ya estaba cerrada
  }
}

export function requiereSetup() {
  if (db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n === 0) return true
  const cfg = db.prepare('SELECT setup_completado FROM configuracion WHERE id = 1').get()
  return !cfg || cfg.setup_completado !== 1
}
