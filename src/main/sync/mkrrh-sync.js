import { ENTIDADES, POR_NOMBRE } from './entidadesLocales.js'
import { prepararEsquema } from './esquemaLocal.js'
import { uuidAsistencia } from './uuidAsistencia.js'

// Cliente de sincronizacion para el proceso principal de MKR RH (Electron).
//
//   import { crearSync } from './sync/mkrrh-sync.js'
//   const sync = crearSync({ db: getDb() })
//   await sync.configurar({ url: 'https://api...', empresa: 'empresa-pescadera' })
//   await sync.iniciarSesion({ usuario: 'ana', password: '****' })
//   await sync.sincronizar()
//
// La app sigue funcionando sin internet: todo se guarda en local y esto sube lo pendiente
// cuando hay red. El tiempo real (client/tiempoReal.js) solo avisa cuando conviene sincronizar.
//
// No hace falta tocar los modulos ipc/: los disparadores de esquemaLocal.js marcan sola
// cada fila que la app escribe.

const ORDEN = ENTIDADES.map((e) => e.nombre)
// Las fotos de empleados viajan en el mismo JSON (hasta 2 MB cada una): un lote chico
// mantiene la peticion dentro del limite de cuerpo del servidor.
const LOTE = 50
const MAX_VUELTAS = 25
const INTENTOS_OPCIONAL = 3

export class ErrorSync extends Error {
  constructor(mensaje, estado, codigo) {
    super(mensaje)
    this.name = 'ErrorSync'
    this.estado = estado
    this.codigo = codigo
  }
}

/** node:sqlite solo acepta null, numero, texto o Buffer. */
function aSqlite(valor) {
  if (valor === undefined || valor === null) return null
  if (typeof valor === 'boolean') return valor ? 1 : 0
  if (typeof valor === 'object') return JSON.stringify(valor)
  return valor
}

export function crearSync({ db, traer = globalThis.fetch, alAvanzar = null, alMarcaje = null }) {
  prepararEsquema(db)

  let acceso = null // token de acceso, solo en memoria
  let enCurso = null
  let marcajes = [] // entradas y salidas que llegaron del servidor en esta aplicacion de cambios

  // -------------------------------------------------------------- estado local

  const control = () => db.prepare('SELECT * FROM sync_control WHERE id = 1').get()

  function guardarControl(campos) {
    const claves = Object.keys(campos)
    if (!claves.length) return
    db.prepare(`UPDATE sync_control SET ${claves.map((c) => `${c} = ?`).join(', ')} WHERE id = 1`).run(
      ...claves.map((c) => aSqlite(campos[c]))
    )
  }

  /** Apaga los disparadores mientras se escriben cambios que vienen del servidor. */
  function sinDisparadores(fn) {
    db.prepare('UPDATE sync_control SET aplicando = 1 WHERE id = 1').run()
    try {
      return fn()
    } finally {
      db.prepare('UPDATE sync_control SET aplicando = 0 WHERE id = 1').run()
    }
  }

  /** Un aviso por problema: mientras nadie lo haya visto no se repite en cada vuelta. */
  function avisar(tipo, entidad, uuid, mensaje) {
    const repetido = db
      .prepare(
        'SELECT 1 FROM sync_avisos WHERE visto = 0 AND tipo = ? AND entidad = ? AND uuid IS ? AND mensaje = ?'
      )
      .get(tipo, entidad, uuid || null, mensaje)
    if (repetido) return

    db.prepare('INSERT INTO sync_avisos (tipo, entidad, uuid, mensaje) VALUES (?, ?, ?, ?)').run(
      tipo,
      entidad,
      uuid || null,
      mensaje
    )
  }

  /** ¿El rol de esta sesion recibe salario, CURP, RFC...? Si el servidor no lo dice, se asume que si. */
  const veSensibles = () => {
    try {
      return JSON.parse(control().permisos || 'null')?.sensibles !== false
    } catch {
      return true
    }
  }

  // -------------------------------------------------------------- http

  function urlDe(ruta) {
    const base = control().url
    if (!base) throw new ErrorSync('Falta configurar la direccion del servidor', 0, 'sin_configurar')
    return base.replace(/\/+$/, '') + ruta
  }

  async function llamar(ruta, { metodo = 'GET', cuerpo, conToken = true } = {}) {
    const cabeceras = { 'content-type': 'application/json' }
    if (conToken && acceso) cabeceras.authorization = `Bearer ${acceso}`

    const respuesta = await traer(urlDe(ruta), {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    })
    const datos = await respuesta.json().catch(() => ({}))
    if (!respuesta.ok) {
      throw new ErrorSync(datos.mensaje || `HTTP ${respuesta.status}`, respuesta.status, datos.error)
    }
    return datos
  }

  /** Igual que llamar(), pero si el token vencio lo renueva y reintenta una vez. */
  async function conSesion(ruta, opciones) {
    if (!acceso) await refrescar()
    try {
      return await llamar(ruta, opciones)
    } catch (e) {
      if (e.estado !== 401) throw e
      await refrescar()
      return llamar(ruta, opciones)
    }
  }

  let refrescando = null // el refresh token se quema al usarse: dos renovaciones a la vez matarian la sesion

  function refrescar() {
    refrescando ??= renovar().finally(() => {
      refrescando = null
    })
    return refrescando
  }

  async function renovar() {
    const { refresh_token: refresco } = control()
    if (!refresco) throw new ErrorSync('No hay sesion iniciada en este equipo', 401, 'sin_sesion')

    let datos
    try {
      datos = await llamar('/auth/refresh', {
        metodo: 'POST',
        cuerpo: { refresh_token: refresco },
        conToken: false
      })
    } catch (e) {
      // Solo se borra si el token rechazado sigue siendo el guardado: otra renovacion pudo haberlo cambiado.
      if (e.estado === 401 && control().refresh_token === refresco) guardarControl({ refresh_token: null })
      throw e
    }
    acceso = datos.token
    guardarControl({ refresh_token: datos.refresh_token, permisos: JSON.stringify(datos.permisos) })
    return datos
  }

  // -------------------------------------------------------------- subida

  function pendientesDe(entidad) {
    const t = entidad.nombre
    const refs = Object.entries(entidad.referencias)
    const joins = refs
      .map(([columna, destino], i) => `LEFT JOIN ${destino} r${i} ON r${i}.id = t.${columna}`)
      .join(' ')
    const extra = refs.map(([columna], i) => `, r${i}.uuid AS ${columna}__uuid`).join('')

    return db
      .prepare(
        `SELECT t.*${extra} FROM ${t} t ${joins}
         WHERE t.pendiente = 1 ORDER BY t.actualizado_en LIMIT ${LOTE}`
      )
      .all()
  }

  function aServidor(entidad, fila) {
    const salida = { id: fila.uuid, actualizado_en: fila.actualizado_en }
    for (const columna of entidad.columnas) {
      salida[columna] = entidad.booleanas.includes(columna) ? !!fila[columna] : (fila[columna] ?? null)
    }
    for (const columna of Object.keys(entidad.referencias)) {
      salida[columna] = fila[`${columna}__uuid`] ?? null
    }
    return salida
  }

  /**
   * La asistencia no tiene uuid propio: es el v5 de (uuid del empleado, fecha). Se estampa justo
   * antes de subir o de aplicar lo que baja, para que la fila local y la que creo la web
   * (o cualquier otra computadora) sean la misma.
   */
  function estamparAsistencia() {
    const filas = db
      .prepare(
        `SELECT a.id, a.fecha, e.uuid AS empleado_uuid
         FROM asistencia a JOIN empleados e ON e.id = a.empleado_id
         WHERE a.uuid IS NULL`
      )
      .all()
    if (!filas.length) return
    sinDisparadores(() => {
      const poner = db.prepare('UPDATE asistencia SET uuid = ? WHERE id = ?')
      for (const f of filas) {
        if (f.empleado_uuid) poner.run(uuidAsistencia(f.empleado_uuid, f.fecha), f.id)
      }
    })
  }

  /** Junta lo pendiente y las lapidas de las entidades que este rol puede escribir. */
  function recolectar(escribibles) {
    estamparAsistencia()
    const cambios = {}
    const enviados = new Map() // uuid -> reloj enviado, para confirmar sin pisar ediciones nuevas

    for (const entidad of ENTIDADES) {
      if (!escribibles.includes(entidad.nombre)) continue
      const filas = pendientesDe(entidad)
      if (!filas.length) continue

      cambios[entidad.nombre] = filas.map((fila) => {
        enviados.set(fila.uuid, fila.actualizado_en)
        return aServidor(entidad, fila)
      })
    }

    const lapidas = db.prepare('SELECT * FROM sync_borrados ORDER BY id LIMIT ?').all(LOTE)
    for (const lapida of lapidas) {
      if (!escribibles.includes(lapida.entidad)) continue
      cambios[lapida.entidad] ||= []
      cambios[lapida.entidad].push({
        id: lapida.uuid,
        actualizado_en: lapida.actualizado_en,
        eliminado: true
      })
    }

    return { cambios, enviados, lapidas }
  }

  function cerrarSubida(subida, enviados, lapidas) {
    const uuidsLapida = new Set(lapidas.map((l) => l.uuid))

    sinDisparadores(() => {
      for (const { entidad, id } of subida.aplicados) {
        // La fila que estaba esperando a su padre ya entro: el aviso deja de tener sentido.
        db.prepare(
          "DELETE FROM sync_avisos WHERE visto = 0 AND tipo = 'esperando_referencia' AND uuid = ?"
        ).run(id)

        if (!ORDEN.includes(entidad) || uuidsLapida.has(id)) continue
        db.prepare(`UPDATE ${entidad} SET pendiente = 0 WHERE uuid = ? AND actualizado_en = ?`).run(
          id,
          enviados.get(id) ?? ''
        )
      }

      // La lapida que el servidor acepto (o que ya tenia mas nueva) ya no hace falta reenviarla.
      const resueltas = new Set([
        ...subida.aplicados.map((a) => a.id),
        ...subida.conflictos.map((c) => c.fila.id)
      ])
      for (const lapida of lapidas) {
        if (resueltas.has(lapida.uuid)) {
          db.prepare('DELETE FROM sync_borrados WHERE id = ?').run(lapida.id)
        }
      }

      // Lo que nunca va a entrar: se deja de reintentar y se avisa a RH.
      // 'duplicado' entra aqui porque el uuid es nuevo y reintentarlo choca igual hasta que
      // alguien renombre o borre el registro que ocupa la llave.
      const definitivos = ['invalido', 'uuid_ajeno', 'sin_permiso', 'id_invalido', 'duplicado']
      for (const r of subida.rechazados) {
        if (!definitivos.includes(r.motivo) || !ORDEN.includes(r.entidad)) continue
        db.prepare(`UPDATE ${r.entidad} SET pendiente = 0 WHERE uuid = ?`).run(r.id)
        db.prepare('DELETE FROM sync_borrados WHERE uuid = ?').run(r.id)
        avisar('rechazado', r.entidad, r.id, r.mensaje || r.motivo)
      }

      // Lo que si se reintenta, pero puede quedarse atorado vueltas y vueltas: se pone a la
      // vista para que no parezca que la agenda simplemente dejo de sincronizar.
      for (const r of subida.rechazados) {
        if (r.motivo !== 'referencia_faltante' || !ORDEN.includes(r.entidad)) continue
        avisar('esperando_referencia', r.entidad, r.id, r.mensaje || r.motivo)
      }
    })

    for (const aviso of subida.avisos) {
      avisar(aviso.tipo, aviso.entidad, aviso.id, aviso.mensaje)
    }
  }

  // -------------------------------------------------------------- bajada

  function idLocalDe(tabla, uuid) {
    if (!uuid) return null
    return db.prepare(`SELECT rowid AS id FROM ${tabla} WHERE uuid = ?`).get(uuid)?.id ?? null
  }

  function diferir(nombre, fila, contar = true) {
    db.prepare(
      `INSERT INTO sync_diferidos (entidad, uuid, fila, intentos) VALUES (?, ?, ?, 1)
       ON CONFLICT (entidad, uuid) DO UPDATE SET fila = excluded.fila, intentos = intentos + ?`
    ).run(nombre, fila.id, JSON.stringify(fila), contar ? 1 : 0)
  }

  function olvidarDiferida(nombre, uuid) {
    db.prepare('DELETE FROM sync_diferidos WHERE entidad = ? AND uuid = ?').run(nombre, uuid)
  }

  /** @returns 'ok' | 'diferida' */
  function guardarFilaLocal(nombre, fila, contar = true) {
    const entidad = POR_NOMBRE[nombre]

    // Las llaves foraneas llegan como uuid; si el padre aun no baja, se deja para despues.
    const refs = {}
    for (const [columna, destino] of Object.entries(entidad.referencias)) {
      const uuid = fila[columna]
      if (!uuid) {
        refs[columna] = null
        continue
      }
      const local = idLocalDe(destino, uuid)
      if (local === null) {
        // Un usuario borrado o un jefe que nunca baja no deben dejar el registro atorado para
        // siempre: tras unos intentos la llave opcional se deja en NULL.
        const intentos =
          db.prepare('SELECT intentos FROM sync_diferidos WHERE entidad = ? AND uuid = ?').get(nombre, fila.id)
            ?.intentos ?? 0
        if (entidad.opcionales?.includes(columna) && intentos >= INTENTOS_OPCIONAL) {
          refs[columna] = null
          continue
        }
        diferir(nombre, fila, contar)
        return 'diferida'
      }
      refs[columna] = local
    }

    let existente = db.prepare(`SELECT rowid AS rid, * FROM ${nombre} WHERE uuid = ?`).get(fila.id)
    // Sin uuid todavia (p. ej. un dia festivo capturado aqui que otro equipo tambien capturo):
    // si la clave natural coincide es la misma fila, se adopta en vez de chocar.
    if (!existente && entidad.claveNatural) {
      const where = entidad.claveNatural.map((c) => `${c} = ?`).join(' AND ')
      const clave = entidad.claveNatural.map((c) => (Object.hasOwn(refs, c) ? refs[c] : fila[c]))
      if (!clave.includes(null) && !clave.includes(undefined)) {
        existente = db.prepare(`SELECT rowid AS rid, * FROM ${nombre} WHERE ${where}`).get(...clave)
      }
    }
    // Una edicion local mas nueva que esta version todavia no subio: gana la local.
    if (existente?.pendiente === 1 && existente.actualizado_en > fila.actualizado_en) {
      olvidarDiferida(nombre, fila.id)
      return 'ok'
    }
    // Una marca hecha en otro equipo o en la web: se avisa despues de confirmar la transaccion.
    if (nombre === 'asistencia' && alMarcaje && fila.origen !== control().dispositivo_id) {
      if (fila.hora_entrada && !existente?.hora_entrada) marcajes.push({ accion: 'entrada', fila })
      if (fila.hora_salida && !existente?.hora_salida) marcajes.push({ accion: 'salida', fila })
    }
    const columnas = [...entidad.columnas, ...Object.keys(entidad.referencias)]

    const valorDe = (columna) => {
      if (Object.hasOwn(refs, columna)) return refs[columna]
      const entrante = fila[columna]
      const vacio = entrante === null || entrante === ''
      // Salario, CURP, banco...: un equipo cuyo rol no los ve recibe nulos; se queda con lo suyo.
      const oculto = !veSensibles() && entidad.sensibles?.includes(columna)
      if (vacio && (entidad.conservarSiVacio?.includes(columna) || oculto)) {
        return existente?.[columna] ?? entidad.siVacio?.[columna]?.() ?? ''
      }
      if ((entrante === null || entrante === '') && entidad.siVacio?.[columna]) {
        return entidad.siVacio[columna]()
      }
      return aSqlite(entrante)
    }

    const escribir = (valores) => {
      if (entidad.singleton) {
        // La configuracion vive siempre en la fila id = 1 de la app.
        const info = db
          .prepare(
            `UPDATE ${nombre} SET ${columnas.map((c) => `${c} = ?`).join(', ')},
             uuid = ?, actualizado_en = ?, pendiente = 0 WHERE id = 1`
          )
          .run(...valores, fila.id, fila.actualizado_en)
        // Una base sin la fila de configuracion (no deberia pasar: la app la siembra) se crea aqui.
        if (!info.changes) {
          db.prepare(
            `INSERT INTO ${nombre} (id, ${columnas.join(', ')}, uuid, actualizado_en, pendiente)
             VALUES (1, ${columnas.map(() => '?').join(', ')}, ?, ?, 0)`
          ).run(...valores, fila.id, fila.actualizado_en)
        }
        return 1
      }
      if (existente) {
        db.prepare(
          `UPDATE ${nombre} SET ${columnas.map((c) => `${c} = ?`).join(', ')},
           uuid = ?, actualizado_en = ?, pendiente = 0 WHERE rowid = ?`
        ).run(...valores, fila.id, fila.actualizado_en, existente.rid)
        return existente.rid
      }
      const info = db
        .prepare(
          `INSERT INTO ${nombre} (${columnas.join(', ')}, uuid, actualizado_en, pendiente)
           VALUES (${columnas.map(() => '?').join(', ')}, ?, ?, 0)`
        )
        .run(...valores, fila.id, fila.actualizado_en)
      return Number(info.lastInsertRowid)
    }

    let localId
    const valores = columnas.map(valorDe)
    try {
      localId = escribir(valores)
    } catch (e) {
      // Dos equipos sin internet pueden generar el mismo numero de empleado. Antes que perder al
      // empleado se guarda con el numero marcado y se avisa para que lo corrijan.
      const choque = entidad.unico && new RegExp(`UNIQUE.*${nombre}\\.${entidad.unico}`, 'i').test(e.message)
      if (!choque) throw e

      const indice = columnas.indexOf(entidad.unico)
      const original = valores[indice]
      valores[indice] = `${original ?? ''}~${String(fila.id).slice(0, 4)}`
      localId = escribir(valores)
      avisar(
        'folio_repetido',
        nombre,
        fila.id,
        `El ${entidad.unico} "${original}" ya existia aqui; este registro quedo como "${valores[indice]}"`
      )
    }

    olvidarDiferida(nombre, fila.id)
    return 'ok'
  }

  function borrarFilaLocal(nombre, fila) {
    const entidad = POR_NOMBRE[nombre]
    if (entidad.singleton) return
    const local = idLocalDe(nombre, fila.id)
    if (local === null) return

    try {
      db.prepare(`DELETE FROM ${nombre} WHERE rowid = ?`).run(local)
    } catch (e) {
      // Otro equipo lo borro pero aqui todavia cuelga historial: se conserva y se avisa.
      avisar('borrado_bloqueado', nombre, fila.id, `No se pudo borrar el registro: ${e.message}`)
    }
    olvidarDiferida(nombre, fila.id)
  }

  /** Avisa las marcas de HOY que llegaron; la primera descarga (cursor 0) es historial, no noticias. */
  function avisarMarcajes(lista, esPrimeraDescarga) {
    if (!alMarcaje || esPrimeraDescarga || !lista.length) return
    const hoyLocal = new Date().toLocaleDateString('en-CA')
    for (const { accion, fila } of lista.filter((m) => m.fila.fecha === hoyLocal).slice(0, 5)) {
      const e = db.prepare('SELECT nombre, apellido_paterno FROM empleados WHERE uuid = ?').get(fila.empleado_id)
      if (!e) continue
      try {
        alMarcaje({
          tipo: 'asistencia',
          accion,
          nombre: `${e.nombre} ${e.apellido_paterno || ''}`.trim(),
          fecha: fila.fecha,
          hora_marcada: accion === 'entrada' ? fila.hora_entrada : fila.hora_salida,
          retardo: accion === 'entrada' ? fila.minutos_retardo || 0 : 0
        })
      } catch {
        /* un aviso que falla nunca debe tirar la sincronizacion */
      }
    }
  }

  function aplicarCambios(cambios) {
    const esPrimeraDescarga = control().cursor === 0
    marcajes = []
    estamparAsistencia()
    const porEntidad = {}
    for (const nombre of ORDEN) porEntidad[nombre] = [...(cambios[nombre] || [])]

    // Reintenta lo que quedo esperando a su empleado en una vuelta anterior.
    for (const guardada of db.prepare('SELECT * FROM sync_diferidos ORDER BY rowid').all()) {
      if (!ORDEN.includes(guardada.entidad)) continue
      porEntidad[guardada.entidad].unshift(JSON.parse(guardada.fila))
    }

    db.exec('BEGIN')
    try {
      sinDisparadores(() => {
        // Primero las altas y ediciones, de padres a hijos...
        for (const nombre of ORDEN) {
          // Una tabla que se apunta a si misma (empleado -> jefe) puede traer al jefe despues del
          // subordinado: se repasa lo diferido mientras cada pasada deje algo guardado.
          let pendientesDeEntidad = porEntidad[nombre].filter((f) => !f.eliminado)
          let primera = true // solo la primera pasada cuenta como intento
          while (pendientesDeEntidad.length) {
            const diferidas = pendientesDeEntidad.filter((f) => guardarFilaLocal(nombre, f, primera) === 'diferida')
            primera = false
            if (diferidas.length === pendientesDeEntidad.length || !POR_NOMBRE[nombre].referencias) break
            if (!Object.values(POR_NOMBRE[nombre].referencias).includes(nombre)) break
            pendientesDeEntidad = diferidas
          }
        }
        // ...y despues los borrados, de hijos a padres.
        for (const nombre of [...ORDEN].reverse()) {
          for (const fila of porEntidad[nombre]) {
            if (fila.eliminado) borrarFilaLocal(nombre, fila)
          }
        }
      })
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      marcajes = []
      throw e
    }
    avisarMarcajes(marcajes, esPrimeraDescarga)
    marcajes = []
  }

  // -------------------------------------------------------------- api publica

  function pendientes() {
    let total = db.prepare('SELECT COUNT(*) AS n FROM sync_borrados').get().n
    for (const entidad of ENTIDADES) {
      total += db.prepare(`SELECT COUNT(*) AS n FROM ${entidad.nombre} WHERE pendiente = 1`).get().n
    }
    return total
  }

  function configurar({ url, empresa }) {
    guardarControl({ url: url ?? null, empresa: empresa ?? null })
    return control()
  }

  /**
   * @param datos.equipoPrincipal  `true` en el equipo que ya tiene los datos de la empresa:
   *   su primera sincronizacion sube lo local tal cual. En los equipos que se suman despues
   *   dejalo en `false` (lo normal): bajan primero, para no pisarle a la empresa la
   *   configuracion real con la de fabrica que trae una instalacion nueva.
   */
  async function iniciarSesion({ usuario, password, nombreEquipo, equipoPrincipal = false }) {
    const c = control()
    if (!c.url || !c.empresa) {
      throw new ErrorSync('Primero configura la direccion del servidor y el alias de la empresa', 0, 'sin_configurar')
    }

    const datos = await llamar('/auth/login', {
      metodo: 'POST',
      conToken: false,
      cuerpo: {
        empresa: c.empresa,
        usuario,
        password,
        canal: 'sync',
        dispositivo: {
          id: c.dispositivo_id || undefined,
          nombre: nombreEquipo || c.usuario || usuario,
          plataforma: process.platform
        }
      }
    })

    acceso = datos.token
    guardarControl({
      usuario,
      dispositivo_id: datos.dispositivo_id,
      refresh_token: datos.refresh_token,
      permisos: JSON.stringify(datos.permisos),
      primer_equipo: equipoPrincipal ? 1 : 0,
      ultimo_error: null
    })
    return { usuario: datos.usuario, empresa: datos.empresa, permisos: datos.permisos }
  }

  function cerrarSesion() {
    const { refresh_token: refresco } = control()
    acceso = null
    guardarControl({ refresh_token: null })
    if (refresco) {
      llamar('/auth/logout', { metodo: 'POST', conToken: false, cuerpo: { refresh_token: refresco } })
        .catch(() => {})
    }
  }

  /**
   * Vuelve a mandar TODO lo local: cursor en 0 y cada fila como pendiente. Es para cuando el
   * servidor ya no tiene lo que este equipo cree haber enviado (base nueva o restaurada). Se
   * conserva actualizado_en, asi que si el servidor tiene una version mas nueva esa gana.
   */
  function reenviarTodo() {
    sinDisparadores(() => {
      for (const entidad of ENTIDADES) db.prepare(`UPDATE ${entidad.nombre} SET pendiente = 1`).run()
      db.prepare('DELETE FROM sync_diferidos').run()
    })
    guardarControl({ cursor: 0, primer_equipo: 1, ultimo_error: null })
  }

  /**
   * Sube lo pendiente y baja lo nuevo, en tantas vueltas como haga falta.
   * Nunca corren dos a la vez: la segunda llamada se cuelga de la primera.
   */
  function sincronizar() {
    if (enCurso) return enCurso
    enCurso = (async () => {
      try {
        const resultado = await unaPasada()
        guardarControl({ ultima_sync: new Date().toISOString(), ultimo_error: null })
        return resultado
      } catch (e) {
        guardarControl({ ultimo_error: e.message })
        throw e
      } finally {
        enCurso = null
      }
    })()
    return enCurso
  }

  /** Solo descarga, hasta agotar las paginas. */
  async function bajarTodo(resumen) {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const r = await conSesion(`/sync/cambios?desde=${control().cursor}`)
      const cuantos = Object.values(r.cambios).reduce((n, filas) => n + filas.length, 0)

      if (cuantos) {
        aplicarCambios(r.cambios)
        resumen.bajados += cuantos
      }
      if (r.cursor > control().cursor) guardarControl({ cursor: r.cursor })
      if (!r.hay_mas) break
    }
  }

  async function unaPasada() {
    const escribibles = JSON.parse(control().permisos || 'null')?.escritura || ORDEN
    const resumen = { subidos: 0, bajados: 0, conflictos: 0, rechazados: 0, vueltas: 0 }

    // Un equipo que se suma a la empresa baja todo antes de subir nada: si no, la
    // configuracion de fabrica de una instalacion nueva —con reloj recien puesto— le ganaria
    // por antiguedad a la real del empresa.
    if (control().cursor === 0 && !control().primer_equipo) await bajarTodo(resumen)

    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const { cambios, enviados, lapidas } = recolectar(escribibles)
      const hayQueSubir = Object.keys(cambios).length > 0

      const respuesta = await conSesion('/sync', {
        metodo: 'POST',
        cuerpo: { desde: control().cursor, cambios }
      })

      const { subida, bajada } = respuesta
      resumen.vueltas++
      resumen.subidos += subida.aplicados.length
      resumen.conflictos += subida.conflictos.length
      resumen.rechazados += subida.rechazados.length

      if (hayQueSubir) cerrarSubida(subida, enviados, lapidas)

      // El servidor gano el conflicto: su version se guarda encima de la local.
      const entrantes = { ...bajada.cambios }
      for (const { entidad, fila } of subida.conflictos) {
        entrantes[entidad] ||= []
        entrantes[entidad].push(fila)
      }

      const bajados = Object.values(entrantes).reduce((n, filas) => n + filas.length, 0)
      if (bajados) {
        aplicarCambios(entrantes)
        resumen.bajados += bajados
      }

      if (bajada.cursor > control().cursor) guardarControl({ cursor: bajada.cursor })
      alAvanzar?.({ ...resumen, cursor: control().cursor })

      // Se sigue mientras haya paginas o mientras la vuelta anterior haya destrabado algo:
      // una asistencia que esperaba a su empleado entra en cuanto el empleado baja.
      const huboProgreso = subida.aplicados.length > 0 || bajados > 0
      if (!bajada.hay_mas && !(huboProgreso && pendientes() > 0)) break
    }

    return { ...resumen, cursor: control().cursor, pendientes: pendientes() }
  }

  function estado() {
    const c = control()
    return {
      configurado: Boolean(c.url && c.empresa),
      con_sesion: Boolean(c.refresh_token),
      url: c.url,
      empresa: c.empresa,
      usuario: c.usuario,
      dispositivo_id: c.dispositivo_id,
      cursor: c.cursor,
      pendientes: pendientes(),
      diferidos: db.prepare('SELECT COUNT(*) AS n FROM sync_diferidos').get().n,
      ultima_sync: c.ultima_sync,
      ultimo_error: c.ultimo_error,
      avisos_sin_ver: db.prepare('SELECT COUNT(*) AS n FROM sync_avisos WHERE visto = 0').get().n
    }
  }

  const avisos = () =>
    db.prepare('SELECT * FROM sync_avisos WHERE visto = 0 ORDER BY id DESC LIMIT 100').all()

  const marcarAvisosVistos = () => db.prepare('UPDATE sync_avisos SET visto = 1').run()

  /** Token de acceso vigente (lo renueva si hace falta); lo usa el canal en vivo para autenticarse. */
  async function tokenDeAcceso() {
    if (!acceso) await refrescar()
    return acceso
  }

  /** URL del canal en vivo: la misma del servidor, con ws:// o wss://. */
  function urlTiempoReal() {
    return urlDe('/ws').replace(/^http/i, 'ws')
  }

  return {
    configurar,
    tokenDeAcceso,
    urlTiempoReal,
    iniciarSesion,
    cerrarSesion,
    sincronizar,
    reenviarTodo,
    estado,
    avisos,
    marcarAvisosVistos
  }
}
