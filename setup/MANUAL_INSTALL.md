# Manual Installation Guide - D Drive Installation

Since automatic installation requires administrator privileges, here's a step-by-step manual installation guide.

## Installation Overview

All components will be installed to **D:\dev\** to avoid using C drive space.

```
D:\dev\
├── postgresql\          # PostgreSQL installation
├── redis\              # Redis installation
└── data\
    ├── postgresql\     # PostgreSQL data directory
    └── redis\          # Redis data directory
```

---

## 1. PostgreSQL Installation

### Download

1. Visit: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
2. Download: **PostgreSQL 16.x for Windows x86-64**
3. File size: ~300 MB

### Installation Steps

1. **Run the installer** (postgresql-16.x-windows-x64.exe)

2. **Installation Directory**
   - Change to: `D:\dev\postgresql`

3. **Data Directory**
   - Change to: `D:\dev\data\postgresql`

4. **Password**
   - Set a strong password for the postgres superuser
   - **IMPORTANT**: Remember this password!

5. **Port**
   - Keep default: `5432`

6. **Locale**
   - Select: `Default locale`

7. **Complete Installation**
   - Uncheck "Launch Stack Builder" at the end

### Add to PATH

1. Open System Environment Variables:
   - Press `Win + X` → System → Advanced system settings
   - Click "Environment Variables"

2. Edit PATH:
   - Under "User variables", select `Path`
   - Click "Edit" → "New"
   - Add: `D:\dev\postgresql\bin`
   - Click "OK" on all dialogs

3. **Restart PowerShell** for changes to take effect

### Verify Installation

```powershell
# Check version
psql --version

# Test connection
psql -U postgres -h localhost

# If successful, you'll see:
# psql (16.x)
# Type "help" for help.
# postgres=#
```

### Create Project Database

```sql
-- Connect to PostgreSQL
psql -U postgres -h localhost

-- Create database
CREATE DATABASE feishu_timesheet;

-- Create user
CREATE USER timesheet_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE feishu_timesheet TO timesheet_user;

-- Verify
\l  -- List all databases
\q  -- Quit
```

---

## 2. Redis Installation

### Download

1. Visit: https://github.com/tporadowski/redis/releases
2. Download: **Redis-x64-5.0.14.1.zip** (or latest 5.x version)
3. File size: ~5 MB

### Installation Steps

1. **Extract the ZIP file**
   - Extract to: `D:\dev\redis`

2. **Create data directory**
   ```powershell
   New-Item -ItemType Directory -Path "D:\dev\data\redis" -Force
   ```

3. **Configure Redis**
   - Open: `D:\dev\redis\redis.windows.conf`
   - Find line: `dir ./`
   - Change to: `dir D:/dev/data/redis`
   - Save the file

### Install as Windows Service

Open PowerShell **as Administrator** and run:

```powershell
cd D:\dev\redis

# Install service
.\redis-server.exe --service-install redis.windows.conf --service-name Redis

# Start service
.\redis-server.exe --service-start

# Verify service is running
Get-Service Redis
```

### Add to PATH (Optional)

1. Open System Environment Variables
2. Edit PATH
3. Add: `D:\dev\redis`
4. Restart PowerShell

### Verify Installation

```powershell
# Check if Redis is running
redis-cli ping
# Expected output: PONG

# Test basic operations
redis-cli
> set test "Hello Redis"
> get test
> exit
```

---

## 3. Verify Complete Environment

Run the verification script:

```powershell
.\setup\verify_environment.ps1
```

Expected output:

```
Checking Python...
  [OK] Python 3.12.10 (meets 3.9+ requirement)
Checking pip...
  [OK] pip 24.x.x
Checking Git...
  [OK] Git 2.53.0
Checking PostgreSQL...
  [OK] PostgreSQL 16.x
  [OK] Database connection successful
Checking Redis...
  [OK] Redis 5.x
  [OK] Redis connection successful

========================================
Environment Status: READY
========================================
```

---

## Troubleshooting

### PostgreSQL Issues

**Problem**: Cannot connect to PostgreSQL

**Solution**:
```powershell
# Check if service is running
Get-Service postgresql*

# Start service if stopped
Start-Service postgresql-x64-16

# Check logs
Get-Content D:\dev\data\postgresql\log\*.log -Tail 50
```

**Problem**: Port 5432 already in use

**Solution**:
```powershell
# Check what's using the port
netstat -ano | findstr :5432

# Kill the process or change PostgreSQL port during installation
```

### Redis Issues

**Problem**: Redis service won't start

**Solution**:
```powershell
# Check service status
Get-Service Redis

# Try starting manually
cd D:\dev\redis
.\redis-server.exe redis.windows.conf

# Check for errors in the output
```

**Problem**: Port 6379 already in use

**Solution**:
```powershell
# Check what's using the port
netstat -ano | findstr :6379

# Edit redis.windows.conf and change port
# Find: port 6379
# Change to: port 6380
```

### PATH Issues

**Problem**: Commands not found after installation

**Solution**:
1. Verify PATH was added correctly
2. **Restart PowerShell** (important!)
3. Or restart your computer

---

## Security Recommendations

### PostgreSQL

1. **Strong Password**
   - Use at least 12 characters
   - Mix uppercase, lowercase, numbers, and symbols

2. **Local Access Only**
   - Default configuration only allows localhost connections
   - Keep it this way for development

3. **Regular Backups**
   ```powershell
   # Backup database
   pg_dump -U postgres feishu_timesheet > backup.sql
   
   # Restore database
   psql -U postgres feishu_timesheet < backup.sql
   ```

### Redis

1. **Add Password Protection**
   - Edit `redis.windows.conf`
   - Add line: `requirepass your_strong_password`
   - Restart Redis service

2. **Bind to Localhost**
   - Edit `redis.windows.conf`
   - Ensure: `bind 127.0.0.1`

3. **Disable Dangerous Commands**
   - Add to config:
   ```
   rename-command FLUSHDB ""
   rename-command FLUSHALL ""
   rename-command CONFIG ""
   ```

---

## Service Management

### Start Services

```powershell
# PostgreSQL
Start-Service postgresql-x64-16

# Redis
Start-Service Redis
```

### Stop Services

```powershell
# PostgreSQL
Stop-Service postgresql-x64-16

# Redis
Stop-Service Redis
```

### Restart Services

```powershell
# PostgreSQL
Restart-Service postgresql-x64-16

# Redis
Restart-Service Redis
```

### Check Service Status

```powershell
# All services
Get-Service postgresql*,Redis

# Detailed status
Get-Service postgresql-x64-16 | Format-List *
```

---

## Next Steps

After completing the installation:

1. ✅ **Task 1**: Development Environment Setup (Current)
2. ⏭️ **Task 2**: Project Structure Initialization
3. ⏭️ **Task 3**: Install Core Dependencies
4. ⏭️ **Task 4**: Configuration Management System

---

## Quick Reference

### PostgreSQL

```powershell
# Connect
psql -U postgres -h localhost

# List databases
\l

# Connect to database
\c feishu_timesheet

# List tables
\dt

# Quit
\q
```

### Redis

```powershell
# Connect
redis-cli

# Test connection
ping

# Set value
set key value

# Get value
get key

# List all keys
keys *

# Quit
exit
```

---

## Installation Checklist

- [ ] PostgreSQL installed to D:\dev\postgresql
- [ ] PostgreSQL data directory at D:\dev\data\postgresql
- [ ] PostgreSQL added to PATH
- [ ] PostgreSQL service running
- [ ] Can connect with psql
- [ ] Project database created
- [ ] Redis installed to D:\dev\redis
- [ ] Redis data directory at D:\dev\data\redis
- [ ] Redis configured
- [ ] Redis service running
- [ ] Can connect with redis-cli
- [ ] Verification script passes

---

## Support

If you encounter issues:

1. Check the Troubleshooting section above
2. Review error messages carefully
3. Check service status and logs
4. Verify PATH configuration
5. Ensure ports are not in use

For more help:
- PostgreSQL docs: https://www.postgresql.org/docs/
- Redis docs: https://redis.io/documentation
