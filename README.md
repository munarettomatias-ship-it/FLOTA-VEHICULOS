# Control de Flota — App de Mantenimiento Vehicular

App web instalable (PWA) para Android e iOS. Sin login: el chofer elige su nombre de una lista, y hay 2 perfiles de administrador.

## ⚠️ Pasos obligatorios antes de desplegar esta versión

1. Corré el SQL `nuevas_tablas.sql` en el SQL Editor de Supabase (crea las tablas de documentos y suscripciones push, y el bucket de storage para fotos de presupuestos).

2. Configurá las notificaciones push (ver sección completa más abajo) — sin este paso, la app funciona normal pero los pushes no se envían.

## Qué incluye

**Para choferes:**
- Inicio con estado de su unidad asignada
- Checklist diario (frenos, luces, neumáticos, niveles, frío, eléctrico, carrocería, espejos/vidrios, documentación)
- Reporte de fallas por categoría (mecánica / frío / eléctrico / carrocería / otro) con foto y nivel de gravedad
- Historial personal de checklists y reportes

**Para administradores (2 perfiles):**
- Dashboard con estadísticas generales (unidades activas, checklists del día, fallas pendientes/críticas)
- Alta de unidades (patente, marca, modelo, año, chofer asignado, km inicial)
- Detalle de cada unidad: historial completo de fallas + historial de services/arreglos realizados (tipo, descripción, taller, costo, km)
- Gestión de fallas reportadas (marcar en revisión / resuelto)
- Alertas preventivas de mantenimiento por kilómetros o por fecha (cambio de aceite, VTV, seguro, patente, etc.)

El estado de cada unidad (verde/amarillo/rojo) se actualiza automáticamente según las fallas reportadas.

## Gestión de mantenimiento y choferes (administrador)

Dentro del detalle de cada unidad (pestaña "Services"), el administrador puede:
- Registrar un nuevo service/arreglo con tipo, descripción, taller, costo total y kilometraje.
- Agregar una lista de repuestos cambiados en ese service, cada uno con cantidad y costo unitario (se suman al total del service automáticamente en la vista).
- Editar o eliminar cualquier registro de service ya guardado.
- Ver el total acumulado invertido en mantenimiento de esa unidad.

En la pestaña "Choferes" del menú inferior, el administrador puede:
- Agregar nuevos choferes.
- Editar el nombre de un chofer existente.
- Eliminar un chofer: si nunca completó checklists ni reportó fallas, se borra para siempre. Si ya tiene historial registrado, en cambio se desactiva (deja de aparecer en las listas, pero ese historial pasado se conserva intacto). Si tenía una unidad asignada, queda sin chofer asignado.

## Acceso de administrador (PIN)

Para evitar que cualquiera con el link entre como administrador, el acceso admin pide un PIN de 4 dígitos. Por defecto son `1111` y `2222` (Administrador 1 y 2) — **cambialos** antes de desplegar, editando en Vercel (o en tu `.env` local) las variables:

```
VITE_ADMIN1_PIN=tu_pin_aca
VITE_ADMIN2_PIN=otro_pin_aca
```

Si alguien falla el PIN 5 veces, esa cuenta queda bloqueada 5 minutos (se guarda en el propio celular, no en la base).

## Arquitectura: caché y tareas en segundo plano

- `src/lib/cache.js`: guarda en memoria, por unos minutos, las listas de **choferes** y **unidades** (son datos que casi no cambian comparado con cuántas veces se piden). Cualquier escritura que las modifique llama a `invalidateUnidades()` / `invalidateChoferes()` para refrescar en la próxima lectura.
- `src/lib/background.js` y `src/lib/unidadOps.js`: tareas que no necesitan bloquear la pantalla del usuario — subir la foto de una falla y recalcular el color de estado de una unidad corren "de fondo" con reintentos automáticos, mientras el chofer ya ve la confirmación de que su reporte se envió.
- Varias pantallas (`AdminHome`, `UnidadDetalle`, `HistorialChofer`, `AlertasAdmin`) piden varios datos independientes en paralelo con `Promise.all` en vez de uno por uno, para que la carga sea más rápida.

## Cómo correr el proyecto en tu computadora

```bash
npm install
npm run dev
```

Esto abre la app en `http://localhost:5173`. Las credenciales de Supabase ya están configuradas en el archivo `.env`.

## Cómo desplegar (Vercel — recomendado, gratis)

1. Subí esta carpeta a un repositorio de GitHub.
2. Entrá a vercel.com, conectá tu cuenta de GitHub.
3. Click en "Add New Project", seleccioná el repositorio.
4. En "Environment Variables", agregá:
   - VITE_SUPABASE_URL = https://hjzscttpmxgvuqojqlyx.supabase.co
   - VITE_SUPABASE_ANON_KEY = (la key que ya tenés)
5. Click en Deploy. En 1-2 minutos tenés una URL pública (ej: flota-tuapp.vercel.app).

## Cómo instalar la app en el celular

**Android (Chrome):**
1. Abrí la URL de la app en Chrome.
2. Tocá el menú (⋮) → "Instalar aplicación" o "Agregar a pantalla de inicio".

**iOS (Safari):**
1. Abrí la URL de la app en Safari.
2. Tocá el botón de compartir (□↑) → "Agregar a pantalla de inicio".

En ambos casos queda como un ícono más en el celular, se abre a pantalla completa, y funciona como una app nativa.

## Estructura del proyecto

```
src/
  lib/
    supabase.js        → cliente de conexión a Supabase
    constants.js        → ítems del checklist, categorías, etc. (editables)
    SessionContext.jsx  → maneja quién está usando la app (sin login real)
  components/
    TopBar.jsx
    BottomNav.jsx
  pages/
    Login.jsx            → selección de chofer/admin
    ChoferHome.jsx        → inicio del chofer
    Checklist.jsx         → checklist diario
    ReportarFalla.jsx     → reporte de desperfectos
    HistorialChofer.jsx   → historial personal del chofer
    AdminHome.jsx         → dashboard del administrador
    Unidades.jsx          → listado y alta de unidades
    UnidadDetalle.jsx     → detalle de unidad: fallas + services + repuestos
    FallasAdmin.jsx       → gestión de todas las fallas reportadas
    AlertasAdmin.jsx      → alertas preventivas de mantenimiento
    ChoferesAdmin.jsx     → gestión de choferes (alta, edición, eliminación)
```

## Notificaciones push (avisos al celular del chofer)

Cuando el admin marca una falla como "en revisión" o "resuelta", el chofer que la reportó recibe una notificación push real en su celular — aparece en la pantalla de bloqueo y centro de notificaciones, igual que WhatsApp, aunque tenga la app cerrada.

### Cómo activarlo (una sola vez)

1. **Andá a tu proyecto en Supabase → Edge Functions → Create a new function**, llamala `notify-falla`, y pegá el contenido del archivo `supabase/functions/notify-falla/index.ts` que está en este zip.

2. En esa misma sección de Edge Functions, andá a **Settings / Secrets** y agregá estas 2 variables de entorno (ya generadas, no las cambies):
   - `VAPID_PUBLIC_KEY` = `BIXny_2W_T6xCMCSpnry-C10aMlo272b6Is9PTHl_QMnKyTXWhN6OG3RJRAi_2ZIMCY8-RU8SQ1mNYlKKI0GmNA`
   - `VAPID_PRIVATE_KEY` = `ZLkZRAcOhr-gWNqdHvbTwfE5pm4wd13MP1PyvmZfnhM`

   Estas claves identifican a tu app frente a Google/Apple para poder mandar notificaciones. Guardalas en un lugar seguro — si las perdés, las suscripciones existentes dejan de funcionar y los choferes deben volver a activar las notificaciones.

3. Listo. No hace falta tocar nada más: la función ya está conectada desde el código de la app (`FallasAdmin.jsx`).

### Cómo lo activa el chofer

La primera vez que un chofer entra a la app, después de unos segundos el navegador le va a preguntar si permite notificaciones. Si toca "Permitir", queda activado. Si lo rechaza sin querer, en su pantalla de Inicio va a ver un cartel naranja "Activá las notificaciones" con un botón para intentarlo de nuevo.

**Importante (iPhone):** las notificaciones push solo funcionan si la app está **instalada** en la pantalla de inicio (Safari → compartir → "Agregar a pantalla de inicio"). Si el chofer la usa solo desde una pestaña del navegador, el permiso no se puede activar — es una limitación de Apple, no de la app.

## Documentos: presupuestos y diagnósticos

Dentro del detalle de cada unidad, la pestaña "📎 Presupuestos" permite al administrador subir fotos (sacadas directo con la cámara del celular) o PDFs de presupuestos y diagnósticos previos a una reparación. Cada documento se guarda con un título, tipo (presupuesto / diagnóstico / otro) y notas opcionales. Las fotos se pueden ver en grande tocándolas.

## Editar o eliminar una unidad

Desde la pantalla "Unidades" del admin, cada unidad tiene un botón "✏️ Editar" que abre un formulario para corregir patente, marca, modelo, año, chofer asignado y kilometraje. También se puede dar de baja una unidad desde ahí (no se borra el historial de checklists/fallas pasadas, solo deja de aparecer en las listas activas).



Editá el archivo `src/lib/constants.js`. Ahí están todas las listas (ítems del checklist, categorías de falla, tipos de service, tipos de alerta) en un solo lugar.

## Ideas para versiones futuras

- Notificaciones push reales (requiere configurar Firebase Cloud Messaging o similar)
- Exportar historial de cada unidad a PDF/Excel
- Ranking de cumplimiento de checklist por chofer
- Control de vencimientos legales (seguro, VTV, patente) integrado con las alertas preventivas
- Modo offline con sincronización automática al recuperar conexión
