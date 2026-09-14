// Iconos en linea para no depender de una fuente externa dentro del empaquetado.
const trazo = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'

export default {
  inicio: `<svg width="18" height="18" viewBox="0 0 18 18" ${trazo}>
    <path d="M2 7.5L9 2l7 5.5V15a1 1 0 01-1 1h-3.5v-5h-5v5H3a1 1 0 01-1-1V7.5z"/>
  </svg>`,
  personas: `<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
    <circle cx="7" cy="5.5" r="3"/>
    <path d="M1 16.5a6 6 0 0112 0H1z"/>
    <circle cx="14" cy="5.5" r="2.3" opacity="0.55"/>
    <path d="M12 16.5a4.5 4.5 0 016 0" opacity="0.55"/>
  </svg>`,
  organigrama: `<svg width="18" height="18" viewBox="0 0 18 18" ${trazo}>
    <rect x="6" y="1.5" width="6" height="4" rx="1"/>
    <rect x="1" y="12.5" width="5.5" height="4" rx="1"/>
    <rect x="11.5" y="12.5" width="5.5" height="4" rx="1"/>
    <path d="M9 5.5v3M3.75 12.5V9.5h10.5v3"/>
  </svg>`,
  palmera: `<svg width="18" height="18" viewBox="0 0 18 18" ${trazo}>
    <path d="M9 6.5v9"/>
    <path d="M9 6.5c-2.5-2-5.5-1.5-7 .5 2-1 4.5-.5 7-.5z"/>
    <path d="M9 6.5c2.5-2 5.5-1.5 7 .5-2-1-4.5-.5-7-.5z"/>
    <path d="M9 6.5c0-2.8 1.6-4.6 3.8-5-1.4 1.4-2.2 3-2.4 5"/>
    <path d="M6.5 16h5"/>
  </svg>`,
  salud: `<svg width="18" height="18" viewBox="0 0 18 18" ${trazo}>
    <rect x="1.5" y="4" width="15" height="11" rx="2"/>
    <path d="M6.5 4V2.5h5V4M9 7.5v4M7 9.5h4"/>
  </svg>`,
  ausencias: `<svg width="18" height="18" viewBox="0 0 18 18" ${trazo}>
    <rect x="1.5" y="3" width="15" height="13.5" rx="2"/>
    <path d="M5.5 1.5v3M12.5 1.5v3M1.5 7.5h15"/>
    <path d="M7 11.5l4 3M11 11.5l-4 3"/>
  </svg>`,
  reloj: `<svg width="18" height="18" viewBox="0 0 18 18" ${trazo}>
    <circle cx="9" cy="9" r="7.2"/>
    <path d="M9 5v4.3l2.8 1.7"/>
  </svg>`,
  dinero: `<svg width="18" height="18" viewBox="0 0 18 18" ${trazo}>
    <rect x="1.5" y="4" width="15" height="10" rx="2"/>
    <circle cx="9" cy="9" r="2.3"/>
    <path d="M4.5 9h.01M13.5 9h.01"/>
  </svg>`,
  salida: `<svg width="18" height="18" viewBox="0 0 18 18" ${trazo}>
    <path d="M2.5 15.5v-2a3 3 0 013-3h3a3 3 0 013 3v2"/>
    <circle cx="7" cy="5" r="3"/>
    <path d="M13.5 5.5h4M15.5 3.5l2 2-2 2"/>
  </svg>`,
  reportes: `<svg width="18" height="18" viewBox="0 0 18 18" ${trazo}>
    <path d="M3.5 1.5h7L15 6v10.5H3.5z"/>
    <path d="M10 1.5V6h4.5M6.5 9.5h5M6.5 12.5h5"/>
  </svg>`,
  catalogo: `<svg width="18" height="18" viewBox="0 0 18 18" ${trazo}>
    <path d="M6 4h10M6 9h10M6 14h10M2.5 4h.01M2.5 9h.01M2.5 14h.01"/>
  </svg>`,
  ajustes: `<svg width="18" height="18" viewBox="0 0 18 18" ${trazo}>
    <circle cx="9" cy="9" r="2.8"/>
    <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.4 3.4l1.4 1.4M13.2 13.2l1.4 1.4M3.4 14.6l1.4-1.4M13.2 4.8l1.4-1.4"/>
  </svg>`,
  logout: `<svg width="18" height="18" viewBox="0 0 18 18" ${trazo}>
    <path d="M7 16H3.5A1.5 1.5 0 012 14.5v-11A1.5 1.5 0 013.5 2H7"/>
    <path d="M12 12.5L16 9l-4-3.5M16 9H7"/>
  </svg>`,
  documento: `<svg width="16" height="16" viewBox="0 0 18 18" ${trazo}>
    <path d="M4 1.5h6L14.5 6v10.5H4z"/>
    <path d="M9.5 1.5V6h4.5"/>
  </svg>`,
  alerta: `<svg width="16" height="16" viewBox="0 0 18 18" ${trazo}>
    <path d="M9 2l7.5 13H1.5L9 2z"/>
    <path d="M9 7v3.5M9 12.8h.01"/>
  </svg>`,
  pastel: `<svg width="16" height="16" viewBox="0 0 18 18" ${trazo}>
    <path d="M2.5 15.5h13v-5a2 2 0 00-2-2h-9a2 2 0 00-2 2v5z"/>
    <path d="M9 8.5v-3M9 3.5a1 1 0 11-1 1"/>
    <path d="M2.5 12h13"/>
  </svg>`,
  medalla: `<svg width="16" height="16" viewBox="0 0 18 18" ${trazo}>
    <circle cx="9" cy="11" r="4.5"/>
    <path d="M6.5 6.8L5 1.5h8l-1.5 5.3"/>
  </svg>`
}
