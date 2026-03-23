# Environment Check Script - No admin required
# Checks if all required components are installed

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Environment Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check Python
Write-Host "Checking Python..." -ForegroundColor Cyan
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python (\d+)\.(\d+)\.(\d+)") {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        if ($major -ge 3 -and $minor -ge 9) {
            Write-Host "  [OK] $pythonVersion" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] $pythonVersion (need 3.9+)" -ForegroundColor Red
            $allGood = $false
        }
    }
} catch {
    Write-Host "  [FAIL] Python not found" -ForegroundColor Red
    $allGood = $false
}

# Check pip
Write-Host "Checking pip..." -ForegroundColor Cyan
try {
    $pipVersion = pip --version 2>&1
    if ($pipVersion -match "pip") {
        Write-Host "  [OK] $pipVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "  [FAIL] pip not found" -ForegroundColor Red
    $allGood = $false
}

# Check Git
Write-Host "Checking Git..." -ForegroundColor Cyan
try {
    $gitVersion = git --version 2>&1
    if ($gitVersion -match "git version") {
        Write-Host "  [OK] $gitVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "  [FAIL] Git not found" -ForegroundColor Red
    $allGood = $false
}

# Check PostgreSQL
Write-Host "Checking PostgreSQL..." -ForegroundColor Cyan
try {
    $psqlVersion = psql --version 2>&1
    if ($psqlVersion -match "psql") {
        Write-Host "  [OK] $psqlVersion" -ForegroundColor Green
        
        # Try to connect
        Write-Host "  Testing connection..." -ForegroundColor Gray
        $env:PGPASSWORD = "postgres"
        $testConn = psql -U postgres -h localhost -c "SELECT version();" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Database connection successful" -ForegroundColor Green
        } else {
            Write-Host "  [WARNING] Cannot connect (may need password)" -ForegroundColor Yellow
        }
        $env:PGPASSWORD = $null
    }
} catch {
    Write-Host "  [FAIL] PostgreSQL not found" -ForegroundColor Red
    Write-Host "  Install from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "  Install to: D:\dev\postgresql" -ForegroundColor Yellow
    $allGood = $false
}

# Check Redis
Write-Host "Checking Redis..." -ForegroundColor Cyan
try {
    $redisVersion = redis-server --version 2>&1
    if ($redisVersion -match "Redis") {
        Write-Host "  [OK] $redisVersion" -ForegroundColor Green
        
        # Try to ping
        Write-Host "  Testing connection..." -ForegroundColor Gray
        $redisPing = redis-cli ping 2>&1
        if ($redisPing -match "PONG") {
            Write-Host "  [OK] Redis connection successful" -ForegroundColor Green
        } else {
            Write-Host "  [WARNING] Redis not responding" -ForegroundColor Yellow
            Write-Host "  Try: Start-Service Redis" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "  [FAIL] Redis not found" -ForegroundColor Red
    Write-Host "  Download from: https://github.com/tporadowski/redis/releases" -ForegroundColor Yellow
    Write-Host "  Extract to: D:\dev\redis" -ForegroundColor Yellow
    $allGood = $false
}

# Check disk space
Write-Host "Checking disk space..." -ForegroundColor Cyan
$dDrive = Get-PSDrive -Name D -ErrorAction SilentlyContinue
if ($dDrive) {
    $freeGB = [math]::Round($dDrive.Free / 1GB, 2)
    Write-Host "  [OK] D: drive has $freeGB GB free" -ForegroundColor Green
} else {
    Write-Host "  [WARNING] D: drive not found" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "Environment Status: READY" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "All required components are installed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Create project database (if not done):" -ForegroundColor White
    Write-Host "   psql -U postgres -h localhost" -ForegroundColor Gray
    Write-Host "   CREATE DATABASE feishu_timesheet;" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Continue with Task 2: Project Structure Initialization" -ForegroundColor White
} else {
    Write-Host "Environment Status: INCOMPLETE" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Some components are missing. Please install them:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See detailed installation guide:" -ForegroundColor Cyan
    Write-Host "  setup\MANUAL_INSTALL.md" -ForegroundColor White
}

Write-Host ""
