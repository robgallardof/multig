# MultiGlacer

Plataforma para manejar múltiples perfiles persistentes de navegador con Camoufox + Next.js + Python.

## Qué hace

- Administra perfiles aislados (cookies, localStorage, huella y estado persistente).
- Soporta perfiles Wplace con Tampermonkey preinstalado.
- Permite subir bundles `.kgm` (preferido) y `.wbot` (compatibilidad).
- Copia automática del userscript **kglacer-macro**.
- Gestión de proxy por perfil (asignación aleatoria sin repetir en activos).
- Inyección de localStorage por instancia (incluyendo idioma y flags de serial).

## Requisitos

- **Node.js 20+**
- **Python 3.10+**
- Sistema con escritorio gráfico si vas a abrir Camoufox en modo visible.
- Descarga Python: https://www.python.org/downloads/
- Descarga Node.js: https://nodejs.org/en/download

## Instalación paso a paso (local)

1. Instala dependencias de Node:

```bash
npm install
```

2. Inicia la app:

```bash
npm run dev
```

3. Abre la UI:

- `http://localhost:6969`

4. En la UI, haz click en **Prepare environment** para instalar entorno Python/Camoufox.
   - Equivale a:

```bash
python -m pip install --upgrade pip
python -m pip install -r python/requirements.txt
python -m camoufox fetch
```

### Scripts de preparación (1 click)

- Windows: `prepare-environment.bat`
- macOS/Linux: `./prepare-environment.command`

Estos scripts:
- validan Python/Node y muestran versiones,
- instalan dependencias con `pnpm` (si existe) o `npm`,
- instalan `python/requirements.txt`,
- ejecutan `python -m camoufox fetch`.

## Crear perfiles paso a paso

### Perfil normal

1. Click en **New profile**.
2. Completa nombre, icono, URL y sistema operativo.
3. (Opcional) Activa/desactiva proxy.
4. Click en **Save**.

### Perfil Wplace

1. Click en **New profile**.
2. Activa **Wplace mode**.
3. Pega tokens (uno por línea o separados por coma).
4. (Opcional) Elige **Reference profile**.
5. Selecciona OS y proxy.
6. Click en **Save**.

> Importante: ya no deberías tener que maximizar manualmente Camoufox para que el flujo continúe. El runner intenta traer ventana al frente y maximizarla automáticamente.

## Notas de preparación Wplace

- Por defecto, la creación de perfiles responde rápido y **no bloquea** esperando preparación pesada de navegador.
- Si necesitas forzar preparación al crear, puedes usar:

```bash
WPLACE_PREPARE_ON_CREATE=1 npm run dev
```


## Addons

Cada instancia nueva incluye:
- Tampermonkey (con acceso a ventana privada activado por defecto)

Addons opcionales:
- JShelter (`javascript-restrictor`) solo si `WPLACE_ENABLE_JSHELTER=true`
- URLs extra con `WPLACE_EXTRA_ADDON_URLS`

Si habilitas JShelter, también queda activado para modo privado por defecto.

## Docker

```bash
docker compose up --build
```

## Scripts de arranque rápido

- Linux npm: `./start-npm.sh` (o `./start.sh`)
- Linux pnpm: `./start-pnpm.sh`
- macOS: `./start.command`
- Windows npm: `start-npm.bat` (o `start.bat`)
- Windows pnpm: `start-pnpm.bat`
- Inicio automático (elige pnpm/npm): `start.bat` (Windows) y `./start.command` (macOS/Linux)

## Troubleshooting

- Si no abre instancias: ejecuta **Prepare environment** y valida Python 3.10+.
- Si falla userscript: valida conectividad a la URL raw del script.
- Si migras script y quieres reinstalar: elimina `profiles/<id>/.wplace_userscript_installed`.
- Si usas Linux sin `DISPLAY`, el runner puede cambiar a modo virtual/headless.

## Arquitectura

- UI: `app/`
- API server: `app/api/*`
- Lógica server: `src/server/*`
- Runner Python Camoufox: `python/run_one.py`
- Persistencia: `data/app.db`, `data/settings.enc.json`, `profiles/<id>/`

## Branding

© 2026 King Gallardo
