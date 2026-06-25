@echo off
cd /d "%~dp0"
title Citi Homes Attendance - Build Android APK

echo.
echo ============================================
echo  Citi Homes Attendance - Android APK Build
echo ============================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js/npm not found. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing npm packages...
  call npm install
)

echo Syncing web app into Android project...
call npm run cap:sync
if errorlevel 1 (
  echo Capacitor sync failed.
  pause
  exit /b 1
)

where java >nul 2>&1
if errorlevel 1 (
  echo.
  echo Java JDK not found on PATH.
  echo Install Android Studio: https://developer.android.com/studio
  echo Then open the android folder:  npm run cap:open
  echo Build APK in Android Studio: Build ^> Build APK
  pause
  exit /b 1
)

echo Building debug APK...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
  echo.
  echo Gradle build failed. Open Android Studio and sync Gradle:
  echo   npm run cap:open
  pause
  exit /b 1
)

echo.
echo ============================================
echo  APK built successfully!
echo ============================================
echo.
echo  File: android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo  Copy this APK to staff phones and install.
echo  On first punch, allow Location permission.
echo.
pause
