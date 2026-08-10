# Handoff: Halcón — App Web de Gestión Operativa de Drones

**Sección Drone Halcón · Departamento de Drone · AMSZO — Municipalidad de Lo Barnechea**

> Documento autosuficiente para implementar la app en un codebase real usando **Claude Code**. Un desarrollador que no participó en el diseño debería poder construir todo desde este README.

---

## 0. Instrucciones para Claude Code (léelo primero)

Estás recibiendo un **prototipo de diseño hecho en HTML** (carpeta `prototipo/`). **No es código de producción para copiar y pegar** — es la referencia visual y de comportamiento. Tu tarea es **recrear estas pantallas como una aplicación web real** con el stack de abajo, respetando fidelidad visual y las reglas de negocio.

**Stack objetivo (acordado con el equipo):**
- **Frontend:** aplicación web responsive tipo **PWA** (instalable en el celular desde el navegador, sin pasar por App Store / Play Store). Framework recomendado: **React + Vite** (o Next.js si se prefiere SSR). Usar como referencia el look del prototipo.
- **Backend / BD / Auth / Roles:** **Supabase** (Postgres + Auth + Row Level Security).
- **Hosting:** **Vercel** o **Netlify** (plan gratuito para empezar).
- **Dominio:** `.cl` (opcional, ~$10.000/año).

**Por qué web y no app nativa:** menor mantención, no se rompe con actualizaciones de iOS/Android, no requiere certificados ni firma de apps. Se instala como PWA (`manifest.json` + service worker) para acceso tipo-app desde la pantalla de inicio.

**Fuera de alcance (excluido explícitamente por el cliente):**
- ❌ Subida de evidencia fotográfica / videos.
- ❌ Integración con OneDrive.
- ❌ Actualización automática de la Bitácora en Excel.
El registro de vuelo va directo del formulario a la confirmación y se guarda en la base de datos.

---

## 1. Overview

App para que operadores de dron ("Halcones") de seguridad municipal registren sus sobrevuelos diarios, y para que supervisores carguen el plan diario y monitoreen el cumplimiento en tiempo real.

Flujo central:
1. El **supervisor** carga el **PDO** (Plan de Despliegue Operativo) del día: qué operador vuela qué tramos, en qué turno y a qué hora.
2. Cada **operador** ve en su cuenta solo los sobrevuelos de su turno y los marca como realizados.
3. El supervisor ve el avance del día y el cumplimiento por turno.

---

## 2. Fidelidad

**Alta fidelidad (hi-fi).** Colores, tipografía, espaciado e interacciones son finales. Recrear la UI fielmente. El prototipo `prototipo/Halcón.dc.html` es un componente propietario (framework "DC"); **no reutilizar ese runtime** — leerlo como especificación visual/funcional y reimplementar en React.

---

## 3. Roles y control de acceso

| Rol | Identificador | Puede |
|---|---|---|
| Operador | HalconN "1"–"7" | Ver su Inicio, su PDO del día, registrar vuelos, ver su historial del día |
| Supervisor | "S4" (Ignacio Vidal), "S23" (Claudio Garay) | Todo lo del operador + cargar PDO + Panel de Supervisión |

- Login por **Supabase Auth** (email + password, o magic link). Mapear el usuario autenticado a su fila en `operadores` por email.
- **Row Level Security** en Postgres: un operador solo lee/escribe sus propios registros; el supervisor lee todo.
- **Los operadores NO deben ver el Panel de Supervisión** (ni en la UI ni por API).

---

## 4. Modelo de datos (Supabase / Postgres)

Poblar `tramos` y `operadores` desde los CSV en `datos/`.

### `tramos` (dato maestro, 69 filas fijas — `datos/Tramos.csv`)
| Columna | Tipo | Notas |
|---|---|---|
| tramo_n | int (PK) | 1–69 |
| nombre | text | Ubicación |
| cuadrante | text | 113, 113A, 114, 114A, 115, 116, 116A, 117 |
| sector | text | Zona agrupadora (La Dehesa, Los Trapenses, Manquehue, Nido de Águilas, San Enrique, El Arrayán) |
| latitud | numeric | |
| longitud | numeric | |

### `operadores` (`datos/Operadores.csv`)
| Columna | Tipo | Notas |
|---|---|---|
| halcon_n | text (PK) | "1"–"7", "S4", "S23" |
| nombre | text | |
| rol | text | 'Operador' \| 'Supervisor' |
| email | text (unique) | Vincula con Supabase Auth. **Reemplazar emails de ejemplo por los reales** |

### `pdo_dia` (lo carga el supervisor cada día — `datos/PDO_Dia_ejemplo.csv` es muestra)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | |
| fecha | date | Día operativo |
| turno | text | 'A' \| 'B' \| 'N' |
| halcon_n | text (FK operadores) | Operador asignado |
| tramo_n | int (FK tramos) | |
| hora | text | Horario programado (HH:MM) |
| estado | text | 'Pendiente' \| 'Realizado' (default 'Pendiente') |

### `registro_vuelos` (lo llena la app al registrar; empieza vacía)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | |
| fecha | date | |
| halcon_n | text (FK) | |
| tramo_n | int (FK) | |
| altura | text | "60 metros" … "600 metros" |
| minutos | int | Duración de vuelo |
| aeronave | text | DUAL \| AUTEL \| 3TD \| MATRICE 300 \| AIR 2 |
| tipificacion | text | Paneo Preventivo \| Paneo Focalizado \| Informe Situacional \| Monitoreo Preventivo \| Constancia de Servicio |
| estado | text | Realizado \| Interrumpido \| Reprogramado |
| observaciones | text | |
| hora_inicio | text | HH:MM |
| pdo_id | uuid (FK pdo_dia, nullable) | Si el vuelo vino de una asignación del PDO |
| created_at | timestamptz | default now() |

---

## 5. Reglas de negocio

1. **Día libre:** si un operador no tiene filas en `pdo_dia` para hoy, su Inicio muestra la tarjeta "Día libre — sin vuelos asignados". No ve cronograma.
2. **Vuelos asignados del operador:** `select * from pdo_dia where halcon_n = <yo> and fecha = <hoy> order by hora`.
3. **Al confirmar un registro** que provino de una asignación del PDO: insertar en `registro_vuelos` **y** actualizar esa fila de `pdo_dia` a estado 'Realizado'.
4. **Turnos:** A = 07:00–14:00 · B = 14:00–22:00 · N = 22:00–07:00.
5. **Turno noche cruza medianoche.** El PDO se fecha por el día en que **inicia** el turno. Para el "hoy" del operador nocturno: `hoy = (hora_actual < 07:00) ? today()-1 : today()`.
6. **Contadores del día únicamente:** "realizados" y "pendientes" siempre referidos al PDO de hoy (todos los turnos), nunca acumulado histórico. Pendientes = sobrevuelos del PDO de hoy con estado 'Pendiente'; se descuentan al marcarse realizados.
7. **Panel de supervisor solo muestra funcionarios en turno según el PDO** de hoy; quien está de día libre no aparece en ninguna métrica.

---

## 6. Pantallas (recrear desde `prototipo/Halcón.dc.html`)

Marco: contenedor tipo teléfono (ancho ~400px), scroll vertical. En web real → layout responsive de una columna, máx ~440px centrado en desktop, full-width en móvil.

### 6.1 Login
- Fondo azul degradado `#16233F → #1C2E52`.
- Escudo circular (logo) en disco blanco con anillo naranjo `rgba(238,107,30,.18)`.
- Título "Sistema de Gestión Operativa de Drones" + wordmark "HALCÓN" en naranjo.
- Tarjeta blanca: selector de usuario (Halcón 1–7), campo contraseña, botón "Ingresar" (naranjo), enlace "Entrar como Supervisor".
- En producción: reemplazar el selector por **login real de Supabase Auth**.

### 6.2 Inicio (Operador)
- Header azul con escudo, "HALCÓN N", nombre, punto verde de estado.
- Dos tarjetas: **Fecha** y **Turno X · Etiqueta · horario** (punto gris si día libre).
- Dos KPIs: "Vuelos hoy" y "Tramos realizados hoy".
- **Tarjeta PDO del día** (si tiene turno): pendientes + próximo horario y tramo → navega a Mis Vuelos.
- Tarjeta "Día libre" (si no figura en PDO).
- Botón grande naranjo "Realizar Tramo" → Selección de Tramo.
- Botón "Historial del Día".
- Botón "Cerrar Sesión".
- ⚠️ Sin acceso a Panel de Supervisión desde el perfil de operador.

### 6.3 Mis Vuelos (cronograma del PDO)
- Header azul con turno y horario, dos KPIs (Pendientes / Realizados).
- Lista "Cronograma de sobrevuelos": cada ítem = Horario | Tramo+nombre | badge estado.
- Ítem pendiente muestra botón "Realizar vuelo →" (naranjo) → abre Registro con ese tramo precargado.
- Cuando todos completos: banner verde "Todos los sobrevuelos del turno completados".

### 6.4 Selección de Tramo (registro libre)
- Header azul con buscador y contadores del día.
- Chips de filtro: Todos · PDO pendientes · Realizados hoy · Mapa (placeholder).
- Lista de los 69 tramos: cuadro con N° de tramo, nombre, sector · cuadrante, y badge solo si está en el PDO de hoy.
- Click en un tramo → Registro.

### 6.5 Registro de Vuelo
- Bloque verde "Completado automáticamente": Fecha, Hora inicio, Funcionario, Operativo.
- Campos: **Altura** (dropdown 60–600 m), **Minutos** (stepper −/+), **Aeronave** (chips), **Tipificación** (dropdown), **Estado** (chips Realizado/Interrumpido/Reprogramado), **Observaciones** (textarea).
- Botón "Revisar y confirmar →" → Confirmación.
- (Ya NO existe el paso de evidencia fotográfica.)

### 6.6 Confirmación
- Tarjeta resumen con encabezado del tramo (N°, nombre, sector · cuadrante) y lista de campos (altura, duración, aeronave, tipificación, cuadrante, estado, observaciones).
- Botones "Editar" y "Confirmar".
- Al confirmar → inserta en `registro_vuelos`, marca PDO realizado si aplica → pantalla Éxito.

### 6.7 Éxito
- Círculo verde con check animado, "Tramo registrado correctamente", tramo + nombre, botón "Volver al inicio" y "Registrar otro tramo".

### 6.8 Historial del Día (Operador)
- Header con conteo de vuelos y minutos.
- Lista de los vuelos del operador registrados hoy (tramo, hora, altura, duración, tipificación).

### 6.9 Cargar PDO (Supervisor)
- Header azul oscuro.
- En el prototipo es un selector de archivo simulado. **En producción:** formulario para agregar filas a `pdo_dia` (fecha, turno, halcón, tramo, hora), o importación desde CSV/Excel, o edición en tabla. El supervisor lo hace **cada día**.
- Muestra distribución por turno (A/B/N) con operador asignado y cantidad de vuelos.

### 6.10 Panel de Supervisión
- Header con "EN VIVO" y selector de supervisor a cargo (S4 / S23).
- Tarjeta "PDO del día" → Cargar PDO.
- **Cumplimiento por funcionario en turno:** por cada turno (A/B/N), operador asignado, badge realizados/total, y lista de sus sobrevuelos con ✓/○.
- KPIs: vuelos del día, horas de vuelo.
- **Avance del PDO del día:** anillo de progreso (realizados / total del PDO de hoy).
- "Vuelos por operador" (solo funcionarios en turno según PDO), barras.
- "Tramos por sector".
- "Mapa de tramos ejecutados" (placeholder — futuro: usar latitud/longitud de `tramos`).
- "Últimos vuelos".

---

## 7. Design tokens

**Colores:**
- Azul institucional (primario/headers): `#16233F`
- Azul header degradado: `#16233F → #1E3057` / `#1C2E52`
- Azul profundo (marco/login): `#0F1A30`
- Naranjo AMSZO (acento/CTA): `#EE6B1E` (degradado botón `#F07D2E → #EE6B1E`)
- Verde OK: `#1E874B` (claro `#3FD07A`, fondos `#E6F4EC` / `#EAF2EC`)
- Ámbar pendiente: texto `#C77B0A`, fondo `#FBF0DC`
- Rojo (logout): `#B03A2E`
- Fondo app: `#EEF1F5` · Superficie tarjeta: `#FFFFFF`
- Bordes: `#E4E8EF` / `#D8DEE7` / `#D3DAE4`
- Texto: título `#16233F`, secundario `#6B7480`, tenue `#8B93A1`, placeholder `#C3CAD5`

**Tipografía:** `'Segoe UI', system-ui, -apple-system, sans-serif`.
- Títulos de pantalla 17px/700 · KPIs 27–34px/800 · cuerpo 13–15px · etiquetas 11–12.5px/600–700.

**Radios:** tarjetas 14–18px · botones 11–15px · chips/badges 20px · disco logo 50%.
**Sombras:** tarjeta `0 1–3px 8–12px rgba(22,35,63,.05)` · CTA `0 8–10px 20–24px rgba(238,107,30,.3)`.
**Altura mínima de botones táctiles:** 44px.

---

## 8. Assets

- `prototipo/assets/logo.png` — escudo "Lo Barnechea 1405 Seguridad" (institucional AMSZO). Presentar en disco blanco circular con anillo naranjo. Reexportar en alta resolución para producción si es posible.

---

## 9. Datos de arranque (`datos/`)

- `Tramos.csv` — 69 tramos con cuadrante, sector y coordenadas → tabla `tramos`.
- `Operadores.csv` — Halcón 1–7 + supervisores S4/S23 (⚠️ emails de ejemplo, reemplazar) → tabla `operadores`.
- `PDO_Dia_ejemplo.csv` — un PDO de muestra (turnos A/B/N) → poblar `pdo_dia` para pruebas.

---

## 10. Checklist de implementación

1. [ ] Crear proyecto Supabase; crear tablas de §4; cargar `Tramos.csv` y `Operadores.csv`.
2. [ ] Configurar Supabase Auth y vincular usuarios a `operadores.email`.
3. [ ] Definir políticas RLS (operador = sus datos; supervisor = todo).
4. [ ] Scaffold React + Vite (o Next.js); configurar cliente Supabase.
5. [ ] Implementar pantallas §6 con los tokens §7.
6. [ ] Implementar reglas de negocio §5 (día libre, turno noche, contadores del día).
7. [ ] Convertir en PWA (`manifest.json`, icono, service worker) para instalación en celular.
8. [ ] Deploy en Vercel/Netlify; conectar dominio `.cl` (opcional).
9. [ ] Probar rol operador y rol supervisor en un celular real.

---

## 11. Archivos del prototipo

- `prototipo/Halcón.dc.html` — prototipo completo (todas las pantallas + lógica de referencia).
- `prototipo/support.js` — runtime del framework de prototipado (no reutilizar en producción).
- `prototipo/assets/logo.png` — escudo institucional.

> Para ver el prototipo: abrir `Halcón.dc.html` en un navegador (o el proyecto original). Es la fuente de verdad visual y funcional.
