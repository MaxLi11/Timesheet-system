# 开发环境验证脚本
# 验证所有必需的开发工具是否正确安装

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "开发环境验证" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# 验证 Python
Write-Host "检查 Python..." -ForegroundColor Cyan
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python (\d+\.\d+\.\d+)") {
        $version = $matches[1]
        $versionParts = $version.Split('.')
        $major = [int]$versionParts[0]
        $minor = [int]$versionParts[1]
        
        if ($major -ge 3 -and $minor -ge 9) {
            Write-Host "  ✓ Python $version (满足 3.9+ 要求)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Python $version (需要 3.9+)" -ForegroundColor Red
            $allPassed = $false
        }
    } else {
        Write-Host "  ✗ 无法获取 Python 版本" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  ✗ Python 未安装" -ForegroundColor Red
    Write-Host "    请从 https://www.python.org/downloads/ 下载安装" -ForegroundColor Yellow
    $allPassed = $false
}

# 验证 pip
Write-Host "检查 pip..." -ForegroundColor Cyan
try {
    $pipVersion = pip --version 2>&1
    if ($pipVersion -match "pip (\d+\.\d+\.\d+)") {
        Write-Host "  ✓ pip $($matches[1])" -ForegroundColor Green
    } else {
        Write-Host "  ✗ 无法获取 pip 版本" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  ✗ pip 未安装" -ForegroundColor Red
    $allPassed = $false
}

# 验证 Git
Write-Host "检查 Git..." -ForegroundColor Cyan
try {
    $gitVersion = git --version 2>&1
    if ($gitVersion -match "git version (\d+\.\d+\.\d+)") {
        Write-Host "  ✓ Git $($matches[1])" -ForegroundColor Green
    } else {
        Write-Host "  ✗ 无法获取 Git 版本" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  ✗ Git 未安装" -ForegroundColor Red
    Write-Host "    请从 https://git-scm.com/download/win 下载安装" -ForegroundColor Yellow
    $allPassed = $false
}

# 验证 PostgreSQL
Write-Host "检查 PostgreSQL..." -ForegroundColor Cyan
try {
    $psqlVersion = psql --version 2>&1
    if ($psqlVersion -match "psql \(PostgreSQL\) (\d+\.\d+)") {
        Write-Host "  ✓ PostgreSQL $($matches[1])" -ForegroundColor Green
        
        # 测试连接
        Write-Host "  测试数据库连接..." -ForegroundColor Gray
        $testResult = psql -U postgres -h localhost -c "SELECT 1;" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ 数据库连接成功" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ 数据库连接失败 (可能需要配置密码)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✗ 无法获取 PostgreSQL 版本" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  ✗ PostgreSQL 未安装" -ForegroundColor Red
    Write-Host "    运行 setup\install_postgresql.ps1 进行安装" -ForegroundColor Yellow
    $allPassed = $false
}

# 验证 Redis
Write-Host "检查 Redis..." -ForegroundColor Cyan
try {
    $redisVersion = redis-server --version 2>&1
    if ($redisVersion -match "Redis server v=(\d+\.\d+\.\d+)") {
        Write-Host "  ✓ Redis $($matches[1])" -ForegroundColor Green
        
        # 测试连接
        Write-Host "  测试 Redis 连接..." -ForegroundColor Gray
        $pingResult = redis-cli ping 2>&1
        if ($pingResult -eq "PONG") {
            Write-Host "  ✓ Redis 连接成功" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ Redis 连接失败 (服务可能未启动)" -ForegroundColor Yellow
            Write-Host "    运行: Start-Service Redis" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ✗ 无法获取 Redis 版本" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  ✗ Redis 未安装" -ForegroundColor Red
    Write-Host "    运行 setup\install_redis.ps1 进行安装" -ForegroundColor Yellow
    $allPassed = $false
}

# 检查服务状态
Write-Host ""
Write-Host "检查服务状态..." -ForegroundColor Cyan

# PostgreSQL 服务
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService) {
    if ($pgService.Status -eq "Running") {
        Write-Host "  ✓ PostgreSQL 服务运行中" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ PostgreSQL 服务未运行" -ForegroundColor Yellow
        Write-Host "    运行: Start-Service $($pgService.Name)" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⚠ 未找到 PostgreSQL 服务" -ForegroundColor Yellow
}

# Redis 服务
$redisService = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
if ($redisService) {
    if ($redisService.Status -eq "Running") {
        Write-Host "  ✓ Redis 服务运行中" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Redis 服务未运行" -ForegroundColor Yellow
        Write-Host "    运行: Start-Service Redis" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⚠ 未找到 Redis 服务" -ForegroundColor Yellow
}

# 检查磁盘空间
Write-Host ""
Write-Host "检查磁盘空间..." -ForegroundColor Cyan
$drive = Get-PSDrive -Name D -ErrorAction SilentlyContinue
if ($drive) {
    $freeSpaceGB = [math]::Round($drive.Free / 1GB, 2)
    if ($freeSpaceGB -gt 10) {
        Write-Host "  ✓ D 盘可用空间: $freeSpaceGB GB" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ D 盘可用空间不足: $freeSpaceGB GB" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠ D 盘不存在" -ForegroundColor Yellow
}

# 检查网络连接
Write-Host ""
Write-Host "检查网络连接..." -ForegroundColor Cyan
try {
    $testConnection = Test-Connection -ComputerName "www.python.org" -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($testConnection) {
        Write-Host "  ✓ 网络连接正常" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ 网络连接可能存在问题" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠ 无法测试网络连接" -ForegroundColor Yellow
}

# 总结
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "✓ 所有必需组件已安装" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "开发环境已就绪!" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步:" -ForegroundColor Cyan
    Write-Host "1. 初始化项目结构 (任务 2)" -ForegroundColor White
    Write-Host "2. 安装 Python 依赖包 (任务 3)" -ForegroundColor White
    Write-Host "3. 配置数据库和 Redis 连接" -ForegroundColor White
} else {
    Write-Host "✗ 部分组件未安装或配置不正确" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "请按照上述提示安装缺失的组件" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "安装脚本:" -ForegroundColor Cyan
    Write-Host "  PostgreSQL: .\setup\install_postgresql.ps1" -ForegroundColor White
    Write-Host "  Redis:      .\setup\install_redis.ps1" -ForegroundColor White
}
Write-Host ""

# 返回状态码
if ($allPassed) {
    exit 0
} else {
    exit 1
}
