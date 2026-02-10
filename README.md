# Camoufox Session Manager

Gestor de perfiles persistentes para Camoufox con UI en Next.js + backend API + runner en Python.

## ¿Qué hace esta app?

La app te permite manejar múltiples perfiles de navegador (sesiones separadas) de forma persistente:

- Cada perfil guarda cookies, localStorage y estado en disco.
- Puedes abrir/cerrar perfiles desde la UI.
- Puedes preparar perfiles para instalar Tampermonkey + userscript automáticamente.
- Puedes asignar proxies (Webshare) para que cada perfil use IP distinta.

En términos simples: **cada perfil es como un navegador independiente que recuerda tu login**.

---

## Arquitectura (cómo funciona por dentro)

- **Frontend/UI**: Next.js (App Router) en `app/`.
- **API server-side**: rutas en `app/api/*` para crear perfiles, lanzar navegador, sync proxies, etc.
- **Lógica de servidor**: `src/server/*` (repositorios, launcher, settings, sqlite, encriptación).
- **Runner Python**: `python/run_one.py` abre Camoufox con perfil persistente e instala addon/userscript.
- **Persistencia**:
  - SQLite: `data/app.db`
  - Config cifrada: `data/settings.enc.json`
  - Perfil por usuario: `profiles/<id>/`

Flujo típico al abrir un perfil:

1. UI llama API de launch.
2. API lee configuración/proxy y arma parámetros.
3. Se ejecuta `python/run_one.py`.
4. Camoufox abre usando `user_data_dir=profiles/<id>`.
5. El perfil conserva estado entre reinicios.

---

## Requisitos

### Forma 1 (la más fácil): repo local

Solo necesitas:

- Node.js 20+
- Python 3.10+

Y correr:

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` y en la UI da click en **Prepare / Instalar**.

Ese botón deja listo Python para Camoufox (venv + paquetes + `camoufox fetch`). Sin ese paso no abrirán los perfiles.

---

### Forma 2: Docker (segunda forma)

Si no quieres instalar Node/Python localmente:

```bash
docker compose up --build
```

Persistencia de datos:

- `./data` → base de datos y settings
- `./profiles` → sesiones persistentes por perfil

Esta opción levanta la app lista para usar, encapsulando runtime dentro del contenedor.

---

### Opción 3: build de producción (sin Docker)

Si quieres correr en modo producción con build local:

```bash
npm install
npm run build
npm start
```

La app queda disponible (por defecto) en `http://localhost:3000`.

> Nota: aunque la UI esté en build, **Python sigue siendo obligatorio** porque el launcher de Camoufox vive en `python/run_one.py`.

---

## Tampermonkey / userscript (caso Camoufox)

Esta app prepara el perfil con Tampermonkey y luego instala el userscript Wplace abriendo directamente el editor de nuevo script.

Ruta usada para entrar al editor:

- `moz-extension://<tampermonkey-uuid>/options.html#nav=new-user-script+editor` (ejemplo real: `moz-extension://a5ddac59-dbda-4c24-9d95-eed108317527/options.html#nav=new-user-script+editor`)
- `moz-extension://<tampermonkey-uuid>/options.html#nav=new-user-script%2Beditor` (fallback)

En ese editor se pega el contenido de `wplace-bot.user.js` y se guarda con `Ctrl+S`.

Variables útiles:

- `WPLACE_TAMPERMONKEY_SCRIPT_URL`: URL del userscript (URL directa al `.user.js`).
- `WPLACE_ENABLED`: habilita inyección de storage de Wplace (`1/true/yes`).
- `WPLACE_WBOT_STORAGE`: JSON serializado para guardar en `localStorage['wbot']`.

---

## Acceso por token (1 por dispositivo)

La app protege UI + API mediante token.

- Lista de tokens: `data/access_tokens.json`
- El token válido se guarda como cookie HTTP-only.
- Si revocas token (`enabled=false`), se bloquea acceso.

Ejemplo:

```json
[
  { "token": "multig-...", "device": "laptop-1", "enabled": true }
]
```

---

## Proxies Webshare

Desde el botón **Webshare** en la UI:

- Guardas token/credenciales en el servidor (cifradas).
- Sincronizas pool de proxies.
- Al abrir un perfil, se asigna proxy aleatorio no repetido entre sesiones activas.
- Puedes liberar/rotar proxy por perfil.

Se recomienda fijar secreto:

```env
APP_SECRET=una-frase-larga-y-secreta
```

Si no existe, se autogenera en `data/app_secret.txt`.

---

## Estructura rápida del proyecto

- `app/` → UI y endpoints API
- `src/server/` → lógica de negocio server-side
- `python/` → runner de Camoufox
- `data/` → SQLite + settings
- `profiles/` → sesiones persistentes

---

## Troubleshooting

### 1) “No instala userscript en Camoufox”

- Ejecuta **Instalar / Preparar** otra vez desde la UI.
- Verifica que el perfil se prepara sin errores.
- Usa preferentemente URL directa de `raw.githubusercontent.com` en `WPLACE_TAMPERMONKEY_SCRIPT_URL`.
- Borra el marcador `profiles/<id>/.wplace_userscript_installed` y vuelve a preparar.
- Nota técnica: cuando Tampermonkey se acaba de copiar como XPI por primera vez, Camoufox hace un primer arranque para activar la extensión y luego un segundo arranque para instalar el userscript.

### 2) Error con `better-sqlite3` en Windows

Instala:

- Python
- Visual Studio Build Tools (workload C++)

Después vuelve a correr:

```bash
npm install
```

---

## Branding

© 2026 robertogallardo.dev  
Development by robertogallardo
