# Quick Start Script - One-click installation of all development environment components

param(
    [switch]$SkipPostgreSQL,
    [switch]$SkipRedis,
    [switch]$AutoYes
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Feishu Timesheet System - Dev Environment Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check admin privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script requires administrator privileges" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please follow these steps:" -ForegroundColor Yellow
    Write-Host "1. Right-click PowerShell" -ForegroundColor White
    Write-Host "2. Select 'Run as Administrator'" -ForegroundColor White
    Write-Host "3. Navigate to project directory" -ForegroundColor White
    Write-Host "4. Run this script again: .\setup\quick_start.ps1" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "This script will install the following components to D drive:" -ForegroundColor Cyan
Write-Host "  * PostgreSQL 16.x (Database)" -ForegroundColor White
Write-Host "  * Redis 5.x (Cache Service)" -ForegroundColor White
Write-Host ""
Write-Host "Already installed:" -ForegroundColor Cyan
Write-Host "  [OK] Python 3.12.10" -ForegroundColor Green
Write-Host "  [OK] Git 2.53.0" -ForegroundColor Green
Write-Host ""

if (-not $AutoYes) {
    $response = Read-Host "Continue with installation? (Y/n)"
    if ($response -eq "n" -or $response -eq "N") {
        Write-Host "Installation cancelled" -ForegroundColor Yellow
        exit 0
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$installSuccess = $true

# Install PostgreSQL
if (-not $SkipPostgreSQL) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Step 1/2: Installing PostgreSQL" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        & "$scriptDir\install_postgresql.ps1"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "PostgreSQL installation encountered issues" -ForegroundColor Yellow
            $installSuccess = $false
        }
    } catch {
        Write-Host "PostgreSQL installation failed: $_" -ForegroundColor Red
        $installSuccess = $false
    }
} else {
    Write-Host "Skipping PostgreSQL installation" -ForegroundColor Yellow
}

# Install Redis
if (-not $SkipRedis) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Step 2/2: Installing Redis" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        & "$scriptDir\install_redis.ps1"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Redis installation encountered issues" -ForegroundColor Yellow
            $installSuccess = $false
        }
    } catch {
        Write-Host "Redis installation failed: $_" -ForegroundColor Red
        $installSuccess = $false
    }
} else {
    Write-Host "Skipping Redis installation" -ForegroundColor Yellow
}

# Verify installation
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verifying Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Start-Sleep -Seconds 2

try {
    & "$scriptDir\verify_environment.ps1"
} catch {
    Write-Host "Verification error: $_" -ForegroundColor Red
}

# Final summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($installSuccess) {
    Write-Host "[OK] Development environment installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Important:" -ForegroundColor Yellow
    Write-Host "1. Please restart PowerShell for environment variables to take effect" -ForegroundColor White
    Write-Host "2. Remember your PostgreSQL password" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Create project database:" -ForegroundColor White
    Write-Host "   psql -U postgres -h localhost" -ForegroundColor Gray
    Write-Host "   CREATE DATABASE feishu_timesheet;" -ForegroundColor Gray
    Write-Host "   CREATE USER timesheet_user WITH PASSWORD 'your_password';" -ForegroundColor Gray
    Write-Host "   GRANT ALL PRIVILEGES ON DATABASE feishu_timesheet TO timesheet_user;" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Initialize project structure (Task 2)" -ForegroundColor White
    Write-Host "3. Install Python dependencies (Task 3)" -ForegroundColor White
    Write-Host ""
    Write-Host "Documentation:" -ForegroundColor Cyan
    Write-Host "  Full guide: setup\SETUP_GUIDE.md" -ForegroundColor White
    Write-Host "  Verify: .\setup\verify_environment.ps1" -ForegroundColor White
} else {
    Write-Host "[WARNING] Installation encountered some issues" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please check the error messages above and:" -ForegroundColor Yellow
    Write-Host "1. Check network connection" -ForegroundColor White
    Write-Host "2. Ensure sufficient disk space" -ForegroundColor White
    Write-Host "3. See setup\SETUP_GUIDE.md for manual installation" -ForegroundColor White
    Write-Host "4. Or run installation scripts separately:" -ForegroundColor White
    Write-Host "   .\setup\install_postgresql.ps1" -ForegroundColor Gray
    Write-Host "   .\setup\install_redis.ps1" -ForegroundColor Gray
}

Write-Host ""
Write-Host "For help, see setup\SETUP_GUIDE.md" -ForegroundColor Cyan
Write-Host ""

if (-not $AutoYes) {
    Read-Host "Press Enter to exit"
}
