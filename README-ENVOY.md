# Running Envoy Proxy for gRPC-Web

This guide explains how to start the Envoy proxy that bridges gRPC-Web requests from the frontend to the Python gRPC backend.

## Prerequisites

1. **Docker Desktop** must be installed and running
   - Download from: https://www.docker.com/products/docker-desktop/
   - Make sure Docker Desktop is fully started (whale icon in system tray should be stable)

## Quick Start

### Option 1: Using PowerShell Script (Recommended)

```powershell
.\start-envoy.ps1
```

This script will:
- Check if Docker Desktop is running
- Start the Envoy container automatically
- Display connection information

### Option 2: Manual Docker Compose

```powershell
# Check Docker is running
docker ps

# Start Envoy (using modern docker compose plugin)
docker compose up -d envoy

# Or using legacy docker-compose
docker-compose up -d envoy
```

## Verifying Envoy is Running

```powershell
# Check container status
docker compose ps

# View logs
docker compose logs envoy

# Follow logs in real-time
docker compose logs -f envoy
```

## Stopping Envoy

```powershell
# Stop Envoy
docker compose down envoy

# Or stop and remove everything
docker compose down
```

## Troubleshooting

### Docker Desktop Not Running

**Error:** `The system cannot find the file specified` or `Cannot connect to the Docker daemon`

**Solution:**
1. Start Docker Desktop from the Start menu
2. Wait for Docker Desktop to fully initialize (whale icon should be stable)
3. Verify with: `docker ps`

### Port Already in Use

**Error:** `Bind for 0.0.0.0:8080 failed: port is already allocated`

**Solution:**
- Check what's using port 8080: `netstat -ano | findstr :8080`
- Stop the conflicting service or change the port in `docker-compose.yaml`

### Envoy Configuration Errors

**Error:** `Error reading configuration: /etc/envoy/envoy.yaml`

**Solution:**
- Verify `envoy.yaml` exists in the project root
- Check file permissions
- Review Envoy logs: `docker compose logs envoy`

## Architecture

```
Frontend (Browser)          Envoy Proxy              Python Backend
     :3000                      :8080                      :50051
     |                           |                           |
     |  gRPC-Web (HTTP/1.1)     |                           |
     |-------------------------->|                           |
     |                           |  gRPC (HTTP/2)           |
     |                           |-------------------------->|
     |                           |                           |
     |                           |  Transcription Response   |
     |                           |<--------------------------|
     |  Transcription Response   |                           |
     |<--------------------------|                           |
```

## Configuration Files

- `envoy.yaml` - Envoy proxy configuration
- `docker-compose.yaml` - Docker Compose service definition

## Admin Interface

Once Envoy is running, you can access the admin interface at:
- http://localhost:9901

This provides metrics, configuration, and debugging information.

