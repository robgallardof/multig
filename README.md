# MultiGlacer

Plataforma para manejar múltiples perfiles persistentes de navegador con Camoufox + Next.js + Python.

## Qué hace

- Administra perfiles aislados (cookies, localStorage, huella y estado persistente).
- Soporta perfiles Wplace con Tampermonkey preinstalado.
- Permite subir bundles `.kgm` (preferido) y `.wbot` (compatibilidad).
- Copia automática del userscript **kglacer-macro** desde:
  - `https://raw.githubusercontent.com/robgallardof/kglacer-macro/refs/heads/main/dist.user.js`
- Gestión de proxy por perfil (asignación aleatoria sin repetir en activos).
- Inyección de localStorage por instancia (incluyendo idioma y flags de serial).

## Arquitectura

- UI: `app/`
- API server: `app/api/*`
- Lógica server: `src/server/*`
- Runner Python Camoufox: `python/run_one.py`
- Persistencia:
  - `data/app.db`
  - `data/settings.enc.json`
  - `profiles/<id>/`

## Requisitos (Server)

### Python

- Requerido: **Python 3.10 o superior**.
- Descarga oficial: https://www.python.org/downloads/

### Node

- Recomendado: Node.js 20+

## Instalación local

```bash
npm install
npm run dev
```

Abre: `http://localhost:6969`

## Preparar entorno Camoufox (Install / Prepare)

El botón **Instalar / Preparar** ejecuta el flujo backend equivalente a:

```bash
python -m pip install --upgrade pip
python -m pip install -r python/requirements.txt
python -m camoufox fetch
```

Este paso instala dependencias del runner y descarga/actualiza binarios de Camoufox.

## Wplace / Tampermonkey / Script

- Cada instancia Wplace prepara Tampermonkey.
- El script se descarga del raw de `kglacer-macro` y se pega en el editor de Tampermonkey.
- Los archivos `.kgm`/`.wbot` se importan a múltiples claves de localStorage según configuración.
- Se intentan rutas de editor compatibles (`userscript.html` y `options.html#nav=...`).

## Modo Play (pintado)

Existe acción **Play (Shift+R)** para abrir instancias Wplace y disparar el hotkey `Shift+R` tras cargar `wplace.live`.

## Docker

```bash
docker compose up --build
```

## Scripts de arranque rápido

- Linux: `./start.sh`
- macOS: `./start.command`
- Windows: `start.bat`

Estos scripts ejecutan `npm install`, levantan la app en puerto **6969**, y abren el navegador por defecto.

## Troubleshooting rápido

- Si no abre instancias: ejecuta **Instalar / Preparar** y verifica Python 3.10+.
- Si falla userscript: valida conectividad a GitHub raw URL del script.
- Si cambias script: vuelve a preparar perfil o elimina marcador de instalación en `profiles/<id>/.wplace_userscript_installed`.

## Branding

© 2026 King Gallardo
