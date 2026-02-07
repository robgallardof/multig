# Camoufox Session Manager

Gestor moderno de **perfiles persistentes** (sesiones) para Camoufox:
- Perfil = usuario (nombre + icono)
- Guardado en disco (`data/profiles.json` + carpeta `profiles/<id>`)
- UI moderna y responsive
- i18n español
- Backend en Next API que lanza Camoufox vía Python

## Branding
© 2026 robertogallardo.dev  
Development by robertogallardo

## Requisitos
- Node.js 20+
- Python 3.10+ (instalado)

## Ejecutar
1) Instala dependencias Node:
```bash
npm install
npm run dev
```

2) Abre la UI:
- http://localhost:3000

3) En la UI, pulsa **“Instalar / Preparar”**
Esto:
- crea `python/.venv`
- instala `camoufox` + `playwright`
- ejecuta `python -m camoufox fetch`

Luego ya puedes abrir perfiles.

## Estructura
- `app/` UI + API routes
- `src/server/` repositorio de perfiles + launcher Camoufox + setup Python
- `python/` runner `run_one.py` y `requirements.txt`
- `data/profiles.json` lista de perfiles
- `profiles/<id>/` carpetas persistentes por perfil


## Proxy por perfil (opcional)

Puedes configurar un proxy por perfil desde la UI (server / username / password).
- El password NO se devuelve al navegador; se guarda solo en el servidor en `data/profiles.json`.
- Para editar un perfil, deja el campo password vacío si no quieres cambiarlo.

⚠️ Seguridad:
- No pegues tokens o credenciales en el frontend.
- Si vas a usar Webshare u otro proveedor, guarda credenciales en `.env.local` y NO las subas a Git.


## Webshare (UI)

En la barra superior hay un botón **Webshare**:
- Guarda Token/Usuario/Password **en el servidor**, encriptado en disco (data/settings.enc.json).
- La UI nunca vuelve a ver los secretos (solo estado + token enmascarado).

Recomendado: define `APP_SECRET` en `.env.local` para una llave estable.
Ejemplo:
```env
APP_SECRET=una-frase-larga-y-secreta
```

Si no defines `APP_SECRET`, el servidor genera uno local y lo guarda en `data/app_secret.txt`.


## Manual proxy assignment (Webshare)

Este proyecto soporta **asignación manual** de proxy por perfil.
- Configura el **token** y (opcional) usuario/password en **Webshare** (botón superior).
- En el modal de perfil, usa **Cargar Webshare proxies** para consultar `GET /api/v2/proxy/list/` y copia/pega el `http://ip:port` que quieras.
- El backend soporta los query params de Webshare: `page`, `page_size`, `ordering`, `search`, y filtros (`status`, etc.).
- No se implementa rotación/auto-asignación.


## SQLite (no localStorage)

La app usa SQLite server-side (`data/app.db`) para:
- perfiles
- pool de proxies (importados desde Webshare)
- asignación (un proxy no se reutiliza entre perfiles)

Flujo:
1) Configura Webshare token en UI.
2) En el modal de perfil: **Sincronizar proxies** (importa a SQLite).
3) Elige un proxy libre en el dropdown y guarda.
4) Si necesitas reutilizar, usa el botón 🔓 para **liberar**.


## Windows note (SQLite)

This project uses `better-sqlite3`. On Windows, if installation fails, install:
- Python (already likely installed)
- Visual Studio Build Tools (C++ workload)
Then run `npm install` again.
