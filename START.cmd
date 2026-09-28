@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer first.
  pause
  exit /b 1
)
if not exist node_modules call npm.cmd ci
if errorlevel 1 exit /b 1
start "" http://localhost:5176
call npm.cmd run dev -- --port 5176
