@echo off
cd /d "%~dp0"
title Citi Homes Attendance Portal - Setup

echo.
echo ============================================
echo  Citi Homes Attendance Portal - Setup
echo ============================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js/npm not found. Install from https://nodejs.org then run this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

if not exist .env (
  echo Creating .env from template...
  copy .env.example .env >nul
)

findstr /R /C:"SUPABASE_DB_PASSWORD=." .env >nul
if errorlevel 1 (
  echo.
  echo STEP 1: Add your Supabase database password to .env
  echo.
  echo   1. Open https://supabase.com/dashboard
  echo   2. Project Settings - Database - Database password
  echo   3. Edit .env and set:  SUPABASE_DB_PASSWORD=your_password
  echo.
  echo   OR paste supabase-setup.sql into Supabase - SQL Editor - Run
  echo   Then open http://localhost:8080/setup.html in your browser
  echo.
  start https://supabase.com/dashboard/project/mnfrbyzdubsgnhxrzuxx/sql/new
  notepad .env
  pause
)

echo Creating database table...
call npm run setup:db
if errorlevel 1 (
  echo.
  echo Database setup failed. Use Supabase SQL Editor and run supabase-setup.sql manually.
  start https://supabase.com/dashboard/project/mnfrbyzdubsgnhxrzuxx/sql/new
  pause
  exit /b 1
)

echo Verifying API...
call npm run verify
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo Setup complete! Starting app at http://localhost:8080
echo Open setup.html to confirm, then index.html to sign in.
echo.
start http://localhost:8080/setup.html
call npm start
