@echo off
setlocal enabledelayedexpansion
cd /d %~dp0

echo ==============================================
echo MultiGlacer - Prepare environment (Windows)
echo ==============================================

echo [check] Python is required: https://www.python.org/downloads/
where python >nul 2>&1
if errorlevel 1 (
  echo [error] Python was not found in PATH.
  echo Install Python 3.10+ and run this script again.
  exit /b 1
)

for /f "delims=" %%V in ('python --version 2^>^&1') do set PYVER=%%V
echo [ok] !PYVER!

echo [check] Node.js is required: https://nodejs.org/en/download
where node >nul 2>&1
if errorlevel 1 (
  echo [error] Node.js was not found in PATH.
  echo Install Node.js 20+ and run this script again.
  exit /b 1
)
for /f "delims=" %%V in ('node --version 2^>^&1') do set NODEVER=%%V
echo [ok] Node !NODEVER!

where pnpm >nul 2>&1
if %errorlevel%==0 (
  set PM=pnpm
) else (
  set PM=npm
)
echo [info] Package manager: !PM!

echo [step] Installing Node dependencies...
call !PM! install
if errorlevel 1 exit /b 1

echo [step] Upgrading pip...
python -m pip install --upgrade pip
if errorlevel 1 exit /b 1

echo [step] Installing Python requirements...
python -m pip install -r python/requirements.txt
if errorlevel 1 exit /b 1

echo [step] Installing Camoufox GeoIP extra...
python -m pip install "camoufox[geoip]"
if errorlevel 1 exit /b 1

echo [step] Fetching Camoufox browser assets...
python -m camoufox fetch
if errorlevel 1 exit /b 1

echo [done] Environment prepared successfully.
echo You can now run start.bat
endlocal
