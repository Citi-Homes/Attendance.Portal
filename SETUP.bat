@echo off
cd /d "%~dp0"
title Citi Homes Attendance Portal - Cloud Setup

echo.
echo ============================================
echo  Citi Homes Attendance Portal - Cloud Setup
echo ============================================
echo.
echo  App URL (share with staff):
echo  https://citi-homes.github.io/Attendance.Portal/
echo.
echo  Data is stored in Supabase only — not on this PC.
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo Opening the live app in your browser...
  start https://citi-homes.github.io/Attendance.Portal/setup.html
  pause
  exit /b 0
)

if not exist node_modules (
  echo Installing dependencies for database scripts...
  call npm install
)

echo.
echo STEP 1: Run SQL in Supabase (if not done already)
echo   - supabase-setup.sql (new install)
echo   - supabase-add-record-date.sql (monthly reports)
echo.
start https://supabase.com/dashboard/project/mnfrbyzdubsgnhxrzuxx/sql/new

echo.
echo STEP 2: Verify Supabase API...
call npm run verify
if errorlevel 1 (
  echo.
  echo Fix issues in Supabase SQL Editor, then run this script again.
  pause
  exit /b 1
)

echo.
echo Setup complete! Opening live app...
start https://citi-homes.github.io/Attendance.Portal/setup.html
echo.
pause
