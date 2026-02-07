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


## Webshare (configuración global)

En la barra superior hay un botón **Webshare**:
- Guarda Token/Usuario/Password **en el servidor**, encriptado en disco (data/settings.enc.json).
- La UI nunca vuelve a ver los secretos (solo estado + token enmascarado).
- Los proxies se asignan automáticamente al abrir un perfil (IP aleatoria, sin repetirse entre instancias activas).

Recomendado: define `APP_SECRET` en `.env.local` para una llave estable.
Ejemplo:
```env
APP_SECRET=una-frase-larga-y-secreta
```

Si no defines `APP_SECRET`, el servidor genera uno local y lo guarda en `data/app_secret.txt`.


## SQLite (no localStorage)

La app usa SQLite server-side (`data/app.db`) para:
- perfiles
- pool de proxies (importados desde Webshare)
- asignación (un proxy no se reutiliza entre perfiles)

Flujo:
1) Configura Webshare token en UI.
2) Sincroniza proxies (botón en el modal Webshare).
3) Abre un perfil: la IP se asigna automáticamente (aleatoria, no reutilizada).
4) Si necesitas rotar IP, usa el botón 🔁 en la tarjeta del perfil.


## Windows note (SQLite)

This project uses `better-sqlite3`. On Windows, if installation fails, install:
- Python (already likely installed)
- Visual Studio Build Tools (C++ workload)
Then run `npm install` again.
