export const CHECKLIST_ITEMS = [
  { key: 'frenos', label: 'Frenos', icon: '🛑' },
  { key: 'luces', label: 'Luces (delanteras, traseras, giros)', icon: '💡' },
  { key: 'neumaticos', label: 'Neumáticos (presión y estado)', icon: '🛞' },
  { key: 'nivel_aceite', label: 'Nivel de aceite', icon: '🛢️' },
  { key: 'nivel_agua', label: 'Nivel de agua / refrigerante', icon: '💧' },
  { key: 'equipo_frio', label: 'Equipo de frío', icon: '❄️' },
  { key: 'electrico', label: 'Sistema eléctrico / batería', icon: '🔌' },
  { key: 'carroceria', label: 'Carrocería / puertas / cerraduras', icon: '🚚' },
  { key: 'espejos_vidrios', label: 'Espejos y vidrios', icon: '🪞' },
  { key: 'documentacion', label: 'Documentación a bordo', icon: '📄' },
]

export const CATEGORIAS_FALLA = [
  { key: 'mecanica', label: 'Mecánica', icon: '🔧' },
  { key: 'frio', label: 'Equipo de frío', icon: '❄️' },
  { key: 'electrico', label: 'Eléctrico', icon: '🔌' },
  { key: 'carroceria', label: 'Carrocería', icon: '🚚' },
  { key: 'otro', label: 'Otro', icon: '❓' },
]

export const GRAVEDAD_OPCIONES = [
  { key: 'baja', label: 'Baja', color: '#16a34a' },
  { key: 'media', label: 'Media', color: '#d97706' },
  { key: 'critica', label: 'Crítica', color: '#dc2626' },
]

export const ESTADO_FALLA = [
  { key: 'pendiente', label: 'Pendiente', color: '#dc2626' },
  { key: 'en_revision', label: 'En revisión', color: '#d97706' },
  { key: 'resuelto', label: 'Resuelto', color: '#16a34a' },
]

export const TIPO_SERVICE = [
  { key: 'preventivo', label: 'Preventivo' },
  { key: 'correctivo', label: 'Correctivo' },
  { key: 'service_programado', label: 'Service programado' },
]

export const TIPO_ALERTA = [
  { key: 'cambio_aceite', label: 'Cambio de aceite' },
  { key: 'vtv', label: 'VTV / RTO' },
  { key: 'seguro', label: 'Seguro' },
  { key: 'patente', label: 'Patente' },
  { key: 'otro', label: 'Otro' },
]
