// Como se ve cada entidad del lado de MKR RH (SQLite) y como se traduce a la del servidor.
//
// La app usa enteros AUTOINCREMENT como llave; el servidor usa uuid. El puente es la columna
// `uuid` que este cliente agrega a cada tabla: al subir se traduce entero -> uuid y al bajar
// uuid -> entero. Las llaves foraneas (departamento_id, empleado_id...) se traducen igual.
//
// Se sincroniza una COPIA COMPLETA: empleados con todos sus datos, catalogos, asistencia,
// vacaciones, incapacidades, permisos, bajas y nomina. Solo se quedan fuera los archivos de
// documentos (viven en disco) y el estado de la instalacion (setup_completado).
//
// Campos opcionales de cada entidad:
//   unico           columna UNIQUE local; si dos equipos la repiten, el que llega se renombra y se avisa
//   claveNatural    columnas que identifican la fila sin uuid; si ya existe una fila local con esa
//                   clave se adopta (se le pone el uuid del servidor) en vez de chocar
//   uuidFijo        el uuid no se inventa: se deriva de los datos (asistencia: empleado + fecha)
//   extras          columnas que la app v1 no tenia y que se agregan a la tabla local
//   conservarSiVacio  columnas que, si el servidor no las manda, conservan el valor local
//   sensibles       columnas que el servidor oculta a los roles sin acceso a datos de nomina; en
//                   un equipo asi se conserva el valor local en lugar de pisarlo con vacio
//   opcionales      llaves foraneas que pueden quedar en NULL si el registro al que apuntan nunca
//                   llega (un usuario borrado, un jefe dado de baja)
//   siVacio         valor local de respaldo para columnas NOT NULL que el servidor puede mandar vacias

const hoy = () => new Date().toISOString().slice(0, 10)

export const ENTIDADES = [
  {
    nombre: 'configuracion',
    singleton: true,
    columnas: ['nombre_empresa', 'razon_social', 'logo', 'rfc', 'registro_patronal', 'direccion', 'telefono', 'correo', 'dias_aguinaldo', 'prima_vacacional', 'periodo_nomina', 'tolerancia_retardo', 'uma_diaria', 'subsidio_mensual', 'subsidio_tope', 'zona_horaria', 'checkin_web'],
    referencias: {},
    booleanas: ['checkin_web'],
    sensibles: ['rfc', 'registro_patronal'],
    extras: [
      { columna: 'zona_horaria', definicion: "TEXT NOT NULL DEFAULT 'America/Mexico_City'" },
      { columna: 'checkin_web', definicion: "INTEGER NOT NULL DEFAULT 1" }
    ],
    siVacio: { zona_horaria: () => 'America/Mexico_City' }
  },
  {
    nombre: 'usuarios',
    unico: 'usuario',
    columnas: ['usuario', 'password_hash', 'salt', 'nombre', 'rol', 'activo', 'creado_en'],
    referencias: {},
    booleanas: ['activo'],
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
    columnas: ['nombre', 'descripcion', 'salario_min', 'salario_max', 'activo', 'creado_en'],
    referencias: { departamento_id: 'departamentos' },
    booleanas: ['activo'],
    sensibles: ['salario_min', 'salario_max'],
    siVacio: { salario_min: () => 0, salario_max: () => 0 }
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
    columnas: ['numero_empleado', 'nombre', 'apellido_paterno', 'apellido_materno', 'fecha_nacimiento', 'genero', 'estado_civil', 'curp', 'rfc', 'nss', 'correo', 'telefono', 'contacto_emergencia', 'telefono_emergencia', 'direccion', 'ciudad', 'estado', 'cp', 'fecha_ingreso', 'tipo_contrato', 'fecha_fin_contrato', 'salario_diario', 'salario_mensual', 'salario_diario_integrado', 'tipo_jornada', 'hora_entrada', 'hora_salida', 'dias_descanso', 'banco', 'clabe', 'foto', 'notas', 'estatus', 'pin_hash', 'pin_salt', 'creado_en'],
    referencias: { departamento_id: 'departamentos', puesto_id: 'puestos', jefe_id: 'empleados' },
    booleanas: [],
    sensibles: ['curp', 'rfc', 'nss', 'salario_diario', 'salario_mensual', 'salario_diario_integrado', 'banco', 'clabe'],
    opcionales: ['jefe_id'],
    extras: [
      { columna: 'pin_hash', definicion: "TEXT NOT NULL DEFAULT ''" },
      { columna: 'pin_salt', definicion: "TEXT NOT NULL DEFAULT ''" }
    ],
    conservarSiVacio: ['pin_hash', 'pin_salt'],
    siVacio: { fecha_ingreso: hoy, salario_diario: () => 0, salario_mensual: () => 0, salario_diario_integrado: () => 0 }
  },
  {
    nombre: 'asistencia',
    columnas: ['fecha', 'hora_entrada', 'hora_salida', 'horas', 'minutos_retardo', 'horas_extra', 'estatus', 'fuente', 'nota', 'creado_en'],
    referencias: { empleado_id: 'empleados', usuario_id: 'usuarios' },
    booleanas: [],
    opcionales: ['usuario_id'],
    claveNatural: ['empleado_id', 'fecha'],
    uuidFijo: true,
    extras: [
      { columna: 'fuente', definicion: "TEXT NOT NULL DEFAULT 'escritorio'" }
    ],
    siVacio: { fuente: () => 'escritorio' }
  },
  {
    nombre: 'bajas',
    columnas: ['fecha_baja', 'motivo', 'descripcion', 'dias_vacaciones', 'monto_vacaciones', 'monto_prima_vacacional', 'monto_aguinaldo', 'monto_salarios', 'otras_percepciones', 'deducciones', 'total_finiquito', 'creado_en'],
    referencias: { empleado_id: 'empleados', usuario_id: 'usuarios' },
    booleanas: [],
    opcionales: ['usuario_id']
  },
  {
    nombre: 'movimientos',
    columnas: ['tipo', 'fecha', 'valor_anterior', 'valor_nuevo', 'nota', 'creado_en'],
    referencias: { empleado_id: 'empleados', usuario_id: 'usuarios' },
    booleanas: [],
    opcionales: ['usuario_id']
  },
  {
    nombre: 'vacaciones',
    columnas: ['fecha_inicio', 'fecha_fin', 'dias', 'periodo', 'motivo', 'estatus', 'comentario', 'pagar_prima', 'fecha_resolucion', 'creado_en'],
    referencias: { empleado_id: 'empleados', resuelto_por: 'usuarios', usuario_id: 'usuarios' },
    booleanas: ['pagar_prima'],
    opcionales: ['resuelto_por', 'usuario_id']
  },
  {
    nombre: 'vacaciones_ajustes',
    columnas: ['dias', 'motivo', 'creado_en'],
    referencias: { empleado_id: 'empleados', usuario_id: 'usuarios' },
    booleanas: [],
    opcionales: ['usuario_id']
  },
  {
    nombre: 'incapacidades',
    columnas: ['folio', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias', 'porcentaje_pago', 'control', 'notas', 'creado_en'],
    referencias: { empleado_id: 'empleados', usuario_id: 'usuarios' },
    booleanas: [],
    opcionales: ['usuario_id']
  },
  {
    nombre: 'permisos',
    columnas: ['tipo', 'fecha_inicio', 'fecha_fin', 'dias', 'horas', 'motivo', 'estatus', 'descuenta', 'comentario', 'fecha_resolucion', 'creado_en'],
    referencias: { empleado_id: 'empleados', resuelto_por: 'usuarios', usuario_id: 'usuarios' },
    booleanas: ['descuenta'],
    opcionales: ['resuelto_por', 'usuario_id']
  },
  {
    nombre: 'conceptos_empleado',
    columnas: ['tipo', 'clave', 'descripcion', 'calculo', 'monto', 'gravable', 'numero_credito', 'total_credito', 'fecha_inicio', 'fecha_fin', 'activo', 'notas', 'creado_en'],
    referencias: { empleado_id: 'empleados', usuario_id: 'usuarios' },
    booleanas: ['gravable', 'activo'],
    opcionales: ['usuario_id']
  },
  {
    nombre: 'nomina_periodos',
    columnas: ['nombre', 'tipo', 'fecha_inicio', 'fecha_fin', 'fecha_pago', 'dias', 'estatus', 'total_percepciones', 'total_deducciones', 'total_neto', 'num_empleados', 'creado_en'],
    referencias: { usuario_id: 'usuarios' },
    booleanas: [],
    opcionales: ['usuario_id']
  },
  {
    nombre: 'nomina_recibos',
    columnas: ['dias_trabajados', 'dias_falta', 'dias_incapacidad', 'dias_vacaciones', 'salario_diario', 'sueldo', 'horas_extra', 'monto_horas_extra', 'prima_vacacional', 'aguinaldo', 'bonos', 'otras_percepciones', 'total_percepciones', 'percepciones_exentas', 'isr', 'subsidio', 'imss', 'infonavit', 'fonacot', 'prestamos', 'descuento_faltas', 'otras_deducciones', 'total_deducciones', 'neto', 'notas'],
    referencias: { periodo_id: 'nomina_periodos', empleado_id: 'empleados' },
    booleanas: [],
    claveNatural: ['periodo_id', 'empleado_id']
  },
  {
    nombre: 'concepto_aplicaciones',
    columnas: ['importe'],
    referencias: { concepto_id: 'conceptos_empleado', periodo_id: 'nomina_periodos', recibo_id: 'nomina_recibos' },
    booleanas: [],
    claveNatural: ['concepto_id', 'periodo_id']
  },
  {
    nombre: 'vacaciones_tabla',
    columnas: ['anio', 'dias'],
    referencias: {},
    booleanas: [],
    claveNatural: ['anio']
  },
  {
    nombre: 'isr_tarifa',
    columnas: ['limite_inferior', 'limite_superior', 'cuota_fija', 'porcentaje'],
    referencias: {},
    booleanas: [],
    claveNatural: ['limite_inferior']
  }
]

export const POR_NOMBRE = Object.fromEntries(ENTIDADES.map((e) => [e.nombre, e]))
