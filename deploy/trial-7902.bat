@echo off
setlocal EnableExtensions

echo ========================================
echo  personlearning_caozuoti - trial run on port 7902
echo ========================================
echo.

:: Optional rehearsal before the real switch: runs the platform-integrated build
:: on a COPY of the data directory. The production container on 7901 is not touched.
:: Remove afterwards with:  docker rm -f personlearning_caozuoti_trial
set "IMAGE_NAME=personlearning_caozuoti"
set "TRIAL_TAG=trial"
set "TRIAL_NAME=personlearning_caozuoti_trial"
set "TRIAL_PORT=7902"
set "DATA_DIR=D:\docker\personlearning_caozuoti\data"
set "TRIAL_DATA_DIR=D:\docker\personlearning_caozuoti\data_trial"
set "PLATFORM_NETWORK=mynet"
set "PLATFORM_BASE_URL=http://adaptive-learning-backend:3000"
set "PLATFORM_WEB_URL=http://192.168.123.3:7669"

docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running. Please start it first.
    pause
    exit /b 1
)

docker network inspect %PLATFORM_NETWORK% >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker network '%PLATFORM_NETWORK%' not found. Start the personlearning platform first.
    pause
    exit /b 1
)

echo [1/4] Building image '%IMAGE_NAME%:%TRIAL_TAG%' ...
docker build -t %IMAGE_NAME%:%TRIAL_TAG% .
if errorlevel 1 (
    echo.
    echo [WARNING] Build failed once. Retrying in 10s ...
    ping -n 11 127.0.0.1 >nul
    docker build -t %IMAGE_NAME%:%TRIAL_TAG% .
)
if errorlevel 1 (
    echo [ERROR] Docker build failed.
    pause
    exit /b 1
)
echo Build successful.
echo.

echo [2/4] Copying '%DATA_DIR%' to '%TRIAL_DATA_DIR%' ...
if exist "%TRIAL_DATA_DIR%" rmdir /s /q "%TRIAL_DATA_DIR%"
robocopy "%DATA_DIR%" "%TRIAL_DATA_DIR%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS >nul
if errorlevel 8 (
    echo [ERROR] Failed to copy the data directory. Check that '%DATA_DIR%' exists.
    pause
    exit /b 1
)
echo Done.
echo.

echo [3/4] Starting trial container on port %TRIAL_PORT% ...
docker rm -f %TRIAL_NAME% >nul 2>&1
docker run -d --name %TRIAL_NAME% ^
    --network %PLATFORM_NETWORK% ^
    -p %TRIAL_PORT%:3000 ^
    -v "%TRIAL_DATA_DIR%:/app/data" ^
    -e AUTH_MODE=platform ^
    -e PLATFORM_BASE_URL=%PLATFORM_BASE_URL% ^
    -e PLATFORM_WEB_URL=%PLATFORM_WEB_URL% ^
    -e PLATFORM_SSO_ENABLED=false ^
    -e STUDENT_JWT_SECRET=trial_only_student_secret_do_not_reuse ^
    -e ADMIN_JWT_SECRET=trial_only_admin_secret_do_not_reuse ^
    %IMAGE_NAME%:%TRIAL_TAG%
if errorlevel 1 (
    echo [ERROR] Failed to start the trial container.
    pause
    exit /b 1
)

echo.
echo [4/4] Verifying ...
ping -n 6 127.0.0.1 >nul
docker ps --filter "name=%TRIAL_NAME%" --format "{{.Names}}  {{.Status}}  {{.Ports}}"
docker logs --tail 5 %TRIAL_NAME%
echo.
echo ========================================
echo  Trial URL  : http://localhost:%TRIAL_PORT%
echo  Sign in at http://localhost:%TRIAL_PORT%/login with a personlearning account.
echo  The one-click entry on the platform points to 7901. Test it after redeploy.bat.
echo  Cleanup    : docker rm -f %TRIAL_NAME%
echo ========================================
echo.
pause
