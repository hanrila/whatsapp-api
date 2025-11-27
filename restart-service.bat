@echo off
REM WhatsApp API Service Restart Script
REM Created for Windows environment as per user requirements

echo ========================================
echo WhatsApp API Service Management
echo ========================================
echo.

REM Check if Node.js is running the service
echo Checking for running WhatsApp API processes...
tasklist /FI "IMAGENAME eq node.exe" /FO TABLE | findstr "node.exe"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Found running Node.js processes. Stopping them...
    taskkill /F /IM node.exe
    echo Node.js processes stopped.
) else (
    echo No Node.js processes found running.
)

echo.
echo Waiting 3 seconds before restart...
timeout /t 3 /nobreak >nul

echo.
echo Starting WhatsApp API service...
echo Current directory: %CD%
echo.

REM Start the service in a new window
start "WhatsApp API" cmd /k "node index.js"

echo.
echo ========================================
echo Service restart completed!
echo The WhatsApp API is now running in a new window.
echo ========================================
echo.
pause