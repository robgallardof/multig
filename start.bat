@echo off
cd /d %~dp0
where pnpm >nul 2>&1
if %errorlevel%==0 (
  echo [start] pnpm detected. Using pnpm...
  call start-pnpm.bat
) else (
  echo [start] pnpm not found. Falling back to npm...
  call start-npm.bat
)
