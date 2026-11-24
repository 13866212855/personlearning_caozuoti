@echo off
setlocal EnableExtensions

echo ========================================
echo  personlearning_caozuoti - Docker Deployment Script (Windows)
echo ========================================
echo.

:: ================= CONFIG =================
set "IMAGE_NAME=personlearning_caozuoti"
set "CONTAINER_NAME=personlearning_caozuoti"
set "HOST_PORT=7901"
set "CONTAINER_PORT=3000"
set "DATA_DIR=D:\docker\personlearning_caozuoti\data"
:: ==========================================

:: [0/5] Check Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running. Please start it first.
    pause
    exit /b 1
)

:: [1/5] Ensure lock file exists (auto-generate if missing and npm is available)
if not exist "package-lock.json" (
    echo [INFO] package-lock.json not found, generating from package.json ...
    where npm >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] package-lock.json not found and npm is not installed locally.
        pause
        exit /b 1
    )
    call npm install --legacy-peer-deps --package-lock-only
    if errorlevel 1 (
        echo [ERROR] Failed to generate package-lock.json.
        pause
        exit /b 1
    )
)

echo [1/5] Building Docker image '%IMAGE_NAME%:latest' ...
echo       ^(dependencies install from lock file, with cache + auto-retry^)
docker build -t %IMAGE_NAME%:latest .
if errorlevel 1 (
    echo.
    echo [WARNING] Build failed once. Retrying in 10s ...
    ping -n 11 127.0.0.1 >nul
    docker build -t %IMAGE_NAME%:latest .
)
if errorlevel 1 (
    echo.
    echo [ERROR] Docker build failed. Deployment aborted.
    echo Please check network / proxy settings, then run again.
    pause
    exit /b 1
)
echo Build successful.
echo.

echo [2/5] Stopping and removing old container...
docker rm -f %CONTAINER_NAME% >nul 2>&1
echo Done.
echo.

echo [3/5] Cleaning up dangling images...
for /f "tokens=*" %%i in ('docker images %IMAGE_NAME% -q --filter "dangling=true" 2^>nul') do docker rmi %%i >nul 2>&1
echo Done.
echo.

echo [4/5] Preparing data directory and starting new container...
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

docker run -d --name %CONTAINER_NAME% ^
    -p %HOST_PORT%:%CONTAINER_PORT% ^
    -v "%DATA_DIR%:/app/data" ^
    --restart unless-stopped ^
    %IMAGE_NAME%:latest
if errorlevel 1 (
    echo [ERROR] Failed to start Docker container.
    pause
    exit /b 1
)

echo.
echo [5/5] Verifying container status...
ping -n 6 127.0.0.1 >nul
set "RUNNING="
for /f "tokens=*" %%i in ('docker inspect -f "{{.State.Running}}" %CONTAINER_NAME% 2^>nul') do set "RUNNING=%%i"
if not "%RUNNING%"=="true" (
    echo [ERROR] Container is NOT running. Recent logs:
    docker logs --tail 30 %CONTAINER_NAME%
    pause
    exit /b 1
)
docker ps --filter "name=%CONTAINER_NAME%" --format "{{.Names}}  {{.Status}}  {{.Ports}}"

echo [INFO] Checking HTTP response on port %HOST_PORT% ...
powershell -NoProfile -Command "$ok=$false; for($i=1;$i -le 8;$i++){ try { $r = Invoke-WebRequest -Uri 'http://localhost:%HOST_PORT%/api/health' -UseBasicParsing -TimeoutSec 10; if($r.StatusCode -eq 200){ Write-Host ('HTTP ' + $r.StatusCode + ' OK'); $ok=$true; break } } catch { Start-Sleep -Seconds 2 } }; if(-not $ok){ Write-Host 'HTTP health check failed after retries'; exit 1 }"
if errorlevel 1 (
    echo [WARNING] HTTP check failed. Recent logs:
    docker logs --tail 30 %CONTAINER_NAME%
    pause
    exit /b 1
)

echo.
echo [INFO] Recent application logs:
docker logs --tail 10 %CONTAINER_NAME%
echo.
echo ========================================
echo  Deployment Successful!
echo ========================================
echo  Access URL: http://localhost:%HOST_PORT%
echo  Data Dir  : %DATA_DIR%
echo ========================================
echo.
pause
