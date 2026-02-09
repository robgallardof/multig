# Camoufox Session Manager

Gestor moderno de **perfiles persistentes** (sesiones) para Camoufox:
- Perfil = usuario (nombre + icono)
- Guardado en disco (`data/profiles.json` + carpeta `profiles/<id>`)
- UI moderna y responsive
- i18n español
- Backend en Next API que lanza Camoufox vía Python
- Selección múltiple de perfiles para acciones en batch (eliminar/exportar)

## Sesiones (mantener login)
El objetivo principal es **conservar sesiones**: si te logueas en una web dentro de un perfil, el login queda guardado
porque la sesión vive en la carpeta `profiles/<id>/` (cookies + storage). Mientras abras ese mismo perfil, sigues logueado.

## Branding
© 2026 robertogallardo.dev  
Development by robertogallardo

## Requisitos
- Node.js 20+
- Python 3.10+ (instalado)

## Acceso por token (1 por dispositivo)
Para limitar el acceso a la app, existe una lista de tokens en `data/access_tokens.json`.
Cada token representa un dispositivo (1 token por device). El flujo es:
1) Abre la app y pega tu token en la pantalla de acceso.
2) El token se guarda en una cookie HTTP-only.
3) Todas las rutas (UI + API) requieren un token válido.

Ejemplo de entrada en `data/access_tokens.json`:
```json
[
  { "token": "multig-...", "device": "laptop-1", "enabled": true }
]
```

Si necesitas revocar un dispositivo, pon `"enabled": false` o elimina la entrada.

## Docker (sin instalar Node/Python local)
Puedes usar Docker para levantar todo sin instalar Node ni Python localmente:
```bash
docker compose up --build
```

Datos persistentes:
- `./data` (DB y settings)
- `./profiles` (sesiones de Camoufox)

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
