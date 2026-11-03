// Canal en vivo entre MKR RH (proceso principal de Electron) y la API.
//
// Cuando alguien marca entrada o salida desde la web, o cuando otra computadora de RH guarda
// cambios, el servidor avisa por WebSocket y este modulo sincroniza al instante en lugar de
// esperar al ciclo de 5 minutos. La app NUNCA depende del socket: si se cae, se reintenta con
// espera creciente y el ciclo periodico sigue cubriendo todo.
//
//   const vivo = crearTiempoReal({
//     sync,
//     alEvento: (evento) => ventana.webContents.send('rt:evento', evento),   // "marco Luis Mora"
//     alSincronizar: (resultado) => ventana.webContents.send('sync:cambios', resultado)
//   })
//   vivo.iniciar()      // despues de iniciar sesion
//   vivo.detener()      // al cerrar sesion o salir

const ESPERA_MIN_MS = 1000
const ESPERA_MAX_MS = 30_000
const REBOTE_MS = 400
// Sin WebSocket (p. ej. la API en Vercel) se sincroniza por sondeo con este periodo.
const SONDEO_MS = 15_000

export function crearTiempoReal({
  sync,
  alEvento = null,
  alSincronizar = null,
  alEstado = null,
  WebSocketImpl = globalThis.WebSocket
}) {
  let socket = null
  let activo = false
  let espera = ESPERA_MIN_MS
  let reintento = null
  let rebote = null
  let sondeo = null
  let estado = 'desconectado' // desconectado | conectando | conectado | sondeo

  function cambiar(nuevo) {
    if (estado === nuevo) return
    estado = nuevo
    alEstado?.(nuevo)
  }

  async function sincronizar() {
    try {
      const resultado = await sync.sincronizar()
      alSincronizar?.(resultado)
    } catch (e) {
      // Sin red o sin sesion: el ciclo periodico lo reintenta; el estado ya queda en sync.estado().
      console.warn('[tiempo-real] no se pudo sincronizar:', e.message)
    }
  }

  /** Varios avisos seguidos (una marca trae asistencia + sync) se juntan en una sola pasada. */
  function pedirSync() {
    clearTimeout(rebote)
    rebote = setTimeout(sincronizar, REBOTE_MS)
  }

  /** Mientras no haya socket, la app pregunta al servidor cada pocos segundos. */
  async function sondear() {
    if (!activo || estado === 'conectado') return
    const e = sync.estado()
    if (!e.configurado || !e.con_sesion) return
    try {
      const resultado = await sync.sincronizar()
      if (!activo || estado === 'conectado') return
      cambiar('sondeo')
      if (resultado.bajados) alSincronizar?.(resultado)
    } catch (err) {
      console.warn('[tiempo-real] sondeo:', err.message)
    }
  }

  function programarReintento() {
    if (!activo) return
    clearTimeout(reintento)
    reintento = setTimeout(conectar, espera)
    espera = Math.min(espera * 2, ESPERA_MAX_MS)
  }

  async function conectar() {
    if (!activo || socket) return
    const e = sync.estado()
    if (!e.configurado || !e.con_sesion) return programarReintento()
    if (!WebSocketImpl) return

    if (estado !== 'sondeo') cambiar('conectando')
    let token
    try {
      token = await sync.tokenDeAcceso()
    } catch {
      cambiar('desconectado')
      return programarReintento()
    }

    let ws
    try {
      ws = new WebSocketImpl(sync.urlTiempoReal())
    } catch {
      cambiar('desconectado')
      return programarReintento()
    }
    socket = ws

    ws.onopen = () => ws.send(JSON.stringify({ tipo: 'auth', token }))

    ws.onmessage = (mensaje) => {
      let evento
      try {
        evento = JSON.parse(mensaje.data)
      } catch {
        return
      }

      if (evento.tipo === 'listo') {
        espera = ESPERA_MIN_MS
        cambiar('conectado')
        // Se pudo perder lo ocurrido mientras el socket estaba caido: se pone al dia.
        pedirSync()
        return
      }

      if (evento.tipo !== 'asistencia' && evento.tipo !== 'sync') return
      alEvento?.(evento)
      // El eco de lo que subio este mismo equipo no necesita otra vuelta.
      if (evento.origen && evento.origen === sync.estado().dispositivo_id) return
      pedirSync()
    }

    ws.onclose = () => {
      socket = null
      if (estado !== 'sondeo') cambiar('desconectado')
      programarReintento()
    }
    ws.onerror = () => {
      // onclose se dispara despues y se encarga del reintento.
    }
  }

  return {
    iniciar() {
      if (activo) return
      activo = true
      espera = ESPERA_MIN_MS
      conectar()
      clearInterval(sondeo)
      sondeo = setInterval(sondear, SONDEO_MS)
    },
    detener() {
      activo = false
      clearTimeout(reintento)
      clearTimeout(rebote)
      clearInterval(sondeo)
      const ws = socket
      socket = null
      try {
        ws?.close(1000, 'cliente detenido')
      } catch {
        /* ya estaba cerrado */
      }
      cambiar('desconectado')
    },
    estado: () => estado
  }
}
