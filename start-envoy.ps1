# PowerShell script to start Envoy proxy
# This script checks if Docker is running and starts the Envoy container

Write-Host "Checking Docker status..." -ForegroundColor Cyan

# Check if Docker is running
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is not running"
    }
    Write-Host "Docker is running!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker Desktop is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start Docker Desktop and wait for it to fully initialize." -ForegroundColor Yellow
    Write-Host "You can start it from the Start menu or by running:" -ForegroundColor Yellow
    Write-Host "  Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "After Docker Desktop starts, run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Starting Envoy proxy..." -ForegroundColor Cyan

# Pull Envoy image if not already present
Write-Host "Ensuring Envoy image is available..." -ForegroundColor Gray
docker pull envoyproxy/envoy:v1.29.0 2>&1 | Out-Null

# Use docker compose (plugin version, recommended)
try {
    docker compose up -d envoy
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Envoy proxy started successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Envoy is running on:" -ForegroundColor Cyan
        Write-Host "  - gRPC-Web endpoint: http://localhost:8080" -ForegroundColor White
        Write-Host "  - Admin interface: http://localhost:9901" -ForegroundColor White
        Write-Host ""
        Write-Host "To view logs, run: docker compose logs -f envoy" -ForegroundColor Gray
        Write-Host "To stop Envoy, run: docker compose down envoy" -ForegroundColor Gray
    } else {
        Write-Host "Failed to start Envoy. Check the error messages above." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error starting Envoy: $_" -ForegroundColor Red
    exit 1
}

