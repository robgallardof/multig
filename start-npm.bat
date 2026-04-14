@echo off
cd /d %~dp0

call npm install
if errorlevel 1 exit /b 1

if not exist .next (
  call npm run build
  if errorlevel 1 exit /b 1
)

start "" "http://localhost:6969"
call npm start
