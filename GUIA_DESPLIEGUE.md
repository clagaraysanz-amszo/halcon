# Guía de despliegue — Halcón

Acompaña al [README.md](README.md) (especificación). Este documento son los **pasos manuales** para dejar la app funcionando: crear Supabase, cargar los datos, configurar la app y publicarla.

Código generado:
- [`app/`](app/) — proyecto React + Vite (PWA) con todas las pantallas del [README.md §6](README.md).
- [`sql/`](sql/) — scripts SQL para Supabase (esquema, RLS, carga de los CSV de `datos/`).

⚠️ **Nota importante:** esta máquina no tiene Node.js instalado, así que el código no pudo compilarse/probarse aquí. Está escrito con cuidado y es internamente consistente, pero **el primer `npm install && npm run dev` es el verdadero test**. Si sale algún error, pégamelo y lo arreglamos de inmediato.

---

## 1. Instalar Node.js

Necesario para instalar dependencias y correr la app.

1. Descarga el instalador **LTS** desde https://nodejs.org (versión 20.x).
2. Instálalo (Next → Next → Finish, opciones por defecto están bien).
3. Verifica en una terminal nueva:

```bash
node -v
npm -v
```

---

## 2. Crear el proyecto en Supabase

1. Ve a https://supabase.com → **Start your project** → crea una cuenta (o inicia sesión).
2. **New project**: nombre (ej. `halcon`), contraseña de base de datos (guárdala), región (elige `South America` si está disponible, o la más cercana), plan **Free**.
3. Espera 1-2 minutos a que se aprovisione.
4. En el panel del proyecto, ve a **Project Settings → API**. Copia:
   - **Project URL** (`https://xxxxx.supabase.co`)
   - **anon public key**

Los vas a necesitar en el paso 5.

---

## 3. Ejecutar los scripts SQL

Ve a **SQL Editor** (menú lateral) → **New query**. Ejecuta estos archivos **en este orden**, uno por uno (pega el contenido completo del archivo y presiona *Run*):

1. [`sql/001_schema.sql`](sql/001_schema.sql) — crea las 4 tablas (`tramos`, `operadores`, `pdo_dia`, `registro_vuelos`).
2. [`sql/002_rls.sql`](sql/002_rls.sql) — activa Row Level Security y las políticas de acceso por rol.
3. [`sql/003_seed_operadores.sql`](sql/003_seed_operadores.sql) — carga los 9 operadores (Halcón 1-7 + S4 + S23).
4. [`sql/004_seed_tramos.sql`](sql/004_seed_tramos.sql) — carga los 69 tramos.
5. [`sql/005_seed_pdo_ejemplo.sql`](sql/005_seed_pdo_ejemplo.sql) — **opcional**, PDO de prueba fechado `2026-08-05` para ver la app funcionando de inmediato. Sáltalo si prefieres partir sin datos de ejemplo.
6. [`sql/006_gps_registro.sql`](sql/006_gps_registro.sql) — agrega las columnas `latitud`/`longitud` a `registro_vuelos` (la app captura el GPS del dispositivo al confirmar cada vuelo y el Panel de Supervisión lo enlaza a Google Maps). Es idempotente y seguro de re-ejecutar.

⚠️ **`003_seed_operadores.sql` usa emails de ejemplo** (`halcon1@lobarnechea.cl`, etc. — ver README §9). Antes de que la gente real inicie sesión, actualízalos a los correos reales, por ejemplo:

```sql
update operadores set email = 'carlos.tapia@lobarnechea.cl' where halcon_n = '1';
```

(Puedes hacerlo ahora editando el script antes de correrlo, o después con `UPDATE`. Lo importante es que estos emails coincidan EXACTO con los que uses en el paso 4.)

---

## 4. Crear los usuarios en Supabase Auth

Cada fila de `operadores` se vincula a un usuario real de Supabase Auth **por email**. Debes crear un usuario de Auth por cada uno de los 9 (7 operadores + 2 supervisores):

1. Ve a **Authentication → Users** → **Add user** → **Create new user**.
2. Email: el mismo que quedó en `operadores.email` para esa persona.
3. Password: define una contraseña temporal (que cada uno pueda cambiar después, o compártela por un canal seguro).
4. Marca **Auto Confirm User** (para que no necesite verificar el correo) y guarda.
5. Repite para los 9.

Alternativa más rápida para 9 usuarios: en **Authentication → Providers**, confirma que **Email** esté habilitado, y usa **Send magic link** en vez de contraseña si prefieres que cada uno entre sin password (la app ya soporta email+password; magic link requeriría un ajuste menor en `Login.jsx` — dilo si lo prefieres así).

---

## 5. Configurar las variables de entorno de la app

1. Entra a la carpeta `app/`.
2. Copia `.env.example` a `.env`:

```bash
cd app
cp .env.example .env
```

3. Abre `.env` y reemplaza con los valores del paso 2:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=ey...tu-anon-key...
```

`.env` ya está en `.gitignore` — nunca se sube al repositorio.

---

## 6. Instalar dependencias y probar en local

```bash
cd app
npm install
npm run dev
```

Abre la URL que muestra la terminal (normalmente `http://localhost:5173`).

- Inicia sesión con uno de los emails de operador que creaste en el paso 4.
- Si cargaste el PDO de ejemplo (`005_seed_pdo_ejemplo.sql`) y hoy es **2026-08-05**, deberías ver el turno asignado y poder registrar un vuelo.
- Inicia sesión con `S4`/`S23` (o el email que definiste) para ver el **Panel de Supervisión**.
- Verifica que un operador **no pueda** ver `/supervisor` aunque escriba la URL a mano (debe redirigir a `/inicio`).

Para probar en tu celular en la misma red wifi: `npm run dev -- --host` y entra desde el celular a `http://<tu-ip-local>:5173`.

> ⚠️ **GPS y HTTPS:** la captura de ubicación (`navigator.geolocation`) solo funciona en contextos seguros. `http://localhost` cuenta como seguro, pero `http://<ip-local>` **no** — así que al probar por IP en el celular el navegador bloqueará el GPS (el vuelo se guarda igual, solo sin coordenadas). En producción esto no aplica: Vercel/Netlify sirven por HTTPS y el GPS funciona normal.

---

## 7. Instalar como PWA

Con la app corriendo (local o ya desplegada, ver paso 8):

- **Android/Chrome**: menú (⋮) → **Instalar app** / **Agregar a pantalla de inicio**.
- **iPhone/Safari**: botón compartir → **Agregar a pantalla de inicio**.

Debería quedar con el ícono del escudo institucional y abrir en modo standalone (sin barra del navegador).

---

## 8. Desplegar en Vercel o Netlify

**Opción Vercel (recomendada, gratis):**

1. Sube la carpeta `app/` a un repositorio de GitHub (puede ser el mismo repo que `sql/` y `README.md`, o uno propio).
2. Ve a https://vercel.com → **Add New Project** → importa el repo.
3. **Root Directory**: `app` (si el repo incluye más carpetas que solo la app).
4. Framework preset: **Vite** (debería detectarlo solo).
5. En **Environment Variables** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (los mismos valores del `.env`).
6. **Deploy**.

**Opción Netlify:** mismo flujo — *Add new site → Import from Git*, Build command `npm run build`, Publish directory `dist`, y las mismas variables de entorno.

---

## 9. Dominio `.cl` (opcional)

1. Compra el dominio (NIC Chile, ~$10.000/año, o vía un registrador que lo soporte).
2. En Vercel/Netlify → **Domains** → agrega tu dominio y sigue las instrucciones de registros DNS (CNAME/A) que te muestren.

---

## 10. Checklist final

- [ ] Node.js instalado y `npm run dev` corre sin errores.
- [ ] Los 5 scripts SQL ejecutados en Supabase (en orden).
- [ ] Emails reales en `operadores` (ya no los de ejemplo).
- [ ] 9 usuarios creados en Supabase Auth con esos mismos emails.
- [ ] `.env` configurado con URL + anon key.
- [ ] Login probado como operador y como supervisor.
- [ ] Confirmado que un operador no accede a `/supervisor`.
- [ ] Desplegado en Vercel/Netlify.
- [ ] Probado instalación PWA en un celular real.
- [ ] (Opcional) Dominio `.cl` conectado.

---

## Decisiones de implementación (para que no te sorprendan)

- **Login real**: se reemplazó el selector de "Halcón 1-7" del prototipo por un formulario de **email + contraseña** (Supabase Auth), tal como pide el README §6.1. El rol (Operador/Supervisor) se resuelve automáticamente leyendo `operadores.rol` por email — no hay botón "Entrar como Supervisor".
- **Cargar PDO**: en vez del selector de archivo simulado del prototipo, se construyó un formulario real (agregar filas manualmente con selects de turno/halcón/tramo/hora) **más** una importación desde CSV con las columnas `Fecha,Turno,HalconN,TramoN,Hora` (mismo formato que `datos/PDO_Dia_ejemplo.csv`).
- **Selector de supervisor "S4/S23" del prototipo**: se eliminó el botón para "cambiar" entre supervisores de forma arbitraria — con Auth real, el supervisor que ves en el panel es quien inició sesión. Si quieren trackear explícitamente "quién está de turno como supervisor" como un dato distinto de "quién está logueado", eso requeriría una tabla adicional no contemplada en el README §4; se puede agregar después si se necesita.
- **Contadores "Vuelos hoy" / "Tramos realizados hoy" (Inicio del operador)**: se interpretaron como el conteo de **sus propios** vuelos de `registro_vuelos` en el día operativo actual (no un contador global de los 69 tramos, que en el prototipo era una simplificación de la demo).
- **Fecha operativa**: se implementó la regla del README §5.5 de forma global: antes de las 07:00 el "día operativo" sigue siendo el día anterior (para no cortar la cola del turno Noche a medianoche). Esto aplica de forma consistente en toda la app (Inicio, Mis Vuelos, Selección de Tramo, Panel de Supervisión).
- **Mapa de tramos**: se dejó como placeholder, igual que en el prototipo — el README lo marca explícitamente como "futuro".
