import { ENTIDADES } from './entidadesLocales.js'

// Columnas y disparadores que se agregan a rh.db para poder sincronizar.
//
// La idea es no tocar el codigo de MKR RH: los disparadores marcan sola cada fila que la app
// inserta, edita o borra, asi que los modulos ipc/ siguen escribiendo SQL como siempre.

const UUID = `lower(
  hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) ||
  '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) ||
  '-' || hex(randomblob(6))
)`

const AHORA = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`

// Mientras se aplican los cambios que bajan del servidor los disparadores se apagan;
// si no, cada fila recibida se marcaria como pendiente y rebotaria de vuelta para siempre.
const APAGADO = `(SELECT aplicando FROM sync_control WHERE id = 1) = 0`

export const TABLAS_CONTROL = `
CREATE TABLE IF NOT EXISTS sync_control (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  aplicando      INTEGER NOT NULL DEFAULT 0,
  cursor         INTEGER NOT NULL DEFAULT 0,
  -- 1 = este equipo trae los datos de la empresa; 0 = los recibe. Ver iniciarSesion().
  primer_equipo  INTEGER NOT NULL DEFAULT 0,
  url            TEXT,
  empresa    TEXT,
  usuario        TEXT,
  dispositivo_id TEXT,
  refresh_token  TEXT,
  permisos       TEXT,
  ultima_sync    TEXT,
  ultimo_error   TEXT
);

INSERT OR IGNORE INTO sync_control (id) VALUES (1);

CREATE TABLE IF NOT EXISTS sync_borrados (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  entidad        TEXT NOT NULL,
  uuid           TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

-- Filas que bajaron pero que todavia no se pueden guardar porque su padre (el empleado de una
-- asistencia, el departamento de un puesto) viene en un lote posterior. Se reintentan en cada sincronizacion hasta que encajan.
CREATE TABLE IF NOT EXISTS sync_diferidos (
  entidad TEXT NOT NULL,
  uuid    TEXT NOT NULL,
  fila    TEXT NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entidad, uuid)
);

-- Lo que RH tiene que revisar a mano: numeros de empleado que dos equipos repartieron igual.
CREATE TABLE IF NOT EXISTS sync_avisos (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo     TEXT NOT NULL,
  entidad  TEXT NOT NULL,
  uuid     TEXT,
  mensaje  TEXT NOT NULL,
  visto    INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`

function columnasDe(tabla) {
  return [
    `ALTER TABLE ${tabla} ADD COLUMN uuid TEXT`,
    `ALTER TABLE ${tabla} ADD COLUMN actualizado_en TEXT`,
    `ALTER TABLE ${tabla} ADD COLUMN pendiente INTEGER NOT NULL DEFAULT 1`
  ]
}

function disparadoresDe(entidad) {
  const t = entidad.nombre
  // La asistencia no inventa su uuid: se deriva de empleado + fecha (ver estamparAsistencia en
  // mkrrh-sync.js), para que la web y esta computadora hablen de la misma fila.
  const asignaUuid = entidad.uuidFijo ? '' : `uuid = COALESCE(uuid, ${UUID}),`
  const marcar = `
    UPDATE ${t} SET
      ${asignaUuid}
      actualizado_en = ${AHORA},
      pendiente = 1
    WHERE id = NEW.id;`

  const sql = [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_${t}_uuid ON ${t} (uuid)`,
    `CREATE INDEX IF NOT EXISTS idx_${t}_pendiente ON ${t} (pendiente)`,
    `CREATE TRIGGER IF NOT EXISTS sync_${t}_ins AFTER INSERT ON ${t}
     WHEN ${APAGADO}
     BEGIN ${marcar} END`,
    `CREATE TRIGGER IF NOT EXISTS sync_${t}_upd AFTER UPDATE ON ${t}
     WHEN ${APAGADO}
     BEGIN ${marcar} END`,
    `CREATE TRIGGER IF NOT EXISTS sync_${t}_del AFTER DELETE ON ${t}
     WHEN ${APAGADO} AND OLD.uuid IS NOT NULL
     BEGIN
       INSERT INTO sync_borrados (entidad, uuid, actualizado_en)
       VALUES ('${t}', OLD.uuid, ${AHORA});
     END`
  ]

  return sql
}

/**
 * Deja la base local lista para sincronizar. Se puede llamar en cada arranque:
 * las columnas que ya existen se ignoran y todo lo demas usa IF NOT EXISTS.
 */
export function prepararEsquema(db) {
  db.exec('PRAGMA recursive_triggers = OFF')
  db.exec(TABLAS_CONTROL)

  for (const entidad of ENTIDADES) {
    const agregar = [
      ...columnasDe(entidad.nombre),
      ...(entidad.extras || []).map((x) => `ALTER TABLE ${entidad.nombre} ADD COLUMN ${x.columna} ${x.definicion}`)
    ]
    for (const sql of agregar) {
      try {
        db.exec(sql)
      } catch (e) {
        // "duplicate column name": ya se habia preparado en un arranque anterior.
        if (!/duplicate column/i.test(e.message)) throw e
      }
    }
    for (const sql of disparadoresDe(entidad)) db.exec(sql)
  }

  // Las filas que ya existian antes de instalar la sincronizacion nacen sin uuid:
  // se les pone uno y quedan pendientes para el primer envio. (La asistencia lo recibe despues,
  // al sincronizar, porque depende del uuid de su empleado.)
  for (const entidad of ENTIDADES) {
    db.exec(
      `UPDATE ${entidad.nombre}
       SET uuid = ${entidad.uuidFijo ? 'uuid' : `COALESCE(uuid, ${UUID})`},
           actualizado_en = COALESCE(actualizado_en, ${AHORA}),
           pendiente = 1
       WHERE uuid IS NULL`
    )
  }
}
