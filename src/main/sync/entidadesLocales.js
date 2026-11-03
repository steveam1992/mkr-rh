// Como se ve cada entidad del lado de MKR RH (SQLite) y como se traduce a la del servidor.
//
// La app usa enteros AUTOINCREMENT como llave; el servidor usa uuid. El puente es la columna
// `uuid` que este cliente agrega a cada tabla: al subir se traduce entero -> uuid y al bajar
// uuid -> entero. Las llaves foraneas (departamento_id, empleado_id...) se traducen igual.
//
// Solo se sincroniza lo que hace falta para asistencia. Salario, CURP, RFC, NSS, nomina,
// vacaciones e incapacidades NO estan aqui: se quedan en esta computadora.
//
// Campos opcionales de cada entidad:
//   unico           columna UNIQUE local; si dos equipos la repiten, el que llega se renombra y se avisa
//   claveNatural    columnas que identifican la fila sin uuid; si ya existe una fila local con esa
//                   clave se adopta (se le pone el uuid del servidor) en vez de chocar
//   uuidFijo        el uuid no se inventa: se deriva de los datos (asistencia: empleado + fecha)
//   extras          columnas que la app v1 no tenia y que se agregan a la tabla local
//   conservarSiVacio  columnas que, si el servidor no las manda, conservan el valor local
//   siVacio         valor local de respaldo para columnas NOT NULL que el servidor puede mandar vacias

const hoy = () => new Date().toISOString().slice(0, 10)

export const ENTIDADES = [
  {
    nombre: 'configuracion',
    singleton: true, // la fila id = 1 de la app
    columnas: [
      'nombre_empresa',
      'razon_social',
      'logo',
      'direccion',
      'telefono',
      'correo',
      'tolerancia_retardo',
      'zona_horaria',
      'checkin_web'
    ],
    referencias: {},
    booleanas: ['checkin_web'],
    extras: [
      { columna: 'zona_horaria', definicion: "TEXT NOT NULL DEFAULT 'America/Mexico_City'" },
      { columna: 'checkin_web', definicion: 'INTEGER NOT NULL DEFAULT 1' }
    ],
    siVacio: { zona_horaria: () => 'America/Mexico_City' }
  },
  {
    nombre: 'usuarios',
    unico: 'usuario',
    columnas: ['usuario', 'password_hash', 'salt', 'nombre', 'rol', 'activo', 'creado_en'],
    referencias: {},
    booleanas: ['activo'],
    // Si el servidor no manda credenciales (SYNC_CREDENCIALES=false) se deja la de aqui:
    // la tabla local las tiene como NOT NULL.
    conservarSiVacio: ['password_hash', 'salt']
  },
  {
    nombre: 'departamentos',
    columnas: ['nombre', 'descripcion', 'activo', 'creado_en'],
    referencias: {},
    booleanas: ['activo']
  },
  {
    nombre: 'puestos',
    columnas: ['nombre', 'descripcion', 'activo', 'creado_en'],
    referencias: { departamento_id: 'departamentos' },
    booleanas: ['activo']
  },
  {
    nombre: 'dias_festivos',
    columnas: ['fecha', 'descripcion'],
    referencias: {},
    booleanas: [],
    claveNatural: ['fecha']
  },
  {
    nombre: 'empleados',
    unico: 'numero_empleado',
    columnas: [
      'numero_empleado',
      'nombre',
      'apellido_paterno',
      'apellido_materno',
      'correo',
      'telefono',
      'fecha_ingreso',
      'hora_entrada',
      'hora_salida',
      'dias_descanso',
      'estatus',
      'pin_hash',
      'pin_salt',
      'creado_en'
    ],
    referencias: { departamento_id: 'departamentos', puesto_id: 'puestos' },
    booleanas: [],
    extras: [
      { columna: 'pin_hash', definicion: "TEXT NOT NULL DEFAULT ''" },
      { columna: 'pin_salt', definicion: "TEXT NOT NULL DEFAULT ''" }
    ],
    // El PIN lo puede dar de alta la web; si el servidor no manda credenciales, se conserva el local.
    conservarSiVacio: ['pin_hash', 'pin_salt'],
    // En la app fecha_ingreso es obligatoria; un empleado dado de alta desde la web puede no traerla.
    siVacio: { fecha_ingreso: hoy }
  },
  {
    nombre: 'asistencia',
    columnas: [
      'fecha',
      'hora_entrada',
      'hora_salida',
      'horas',
      'minutos_retardo',
      'horas_extra',
      'estatus',
      'fuente',
      'nota',
      'creado_en'
    ],
    referencias: { empleado_id: 'empleados' },
    booleanas: [],
    claveNatural: ['empleado_id', 'fecha'],
    uuidFijo: true,
    extras: [{ columna: 'fuente', definicion: "TEXT NOT NULL DEFAULT 'escritorio'" }],
    siVacio: { fuente: () => 'escritorio' }
  }
]

export const POR_NOMBRE = Object.fromEntries(ENTIDADES.map((e) => [e.nombre, e]))
