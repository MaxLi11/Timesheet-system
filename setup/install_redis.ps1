# Redis 自动安装脚本
# 安装路径: D:\dev\redis
# 数据路径: D:\dev\data\redis

param(
    [string]$InstallDir = "D:\dev\redis",
    [string]$DataDir = "D:\dev\data\redis",
    [int]$Port = 6379
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Redis 安装脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否以管理员身份运行
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "错误: 请以管理员身份运行此脚本" -ForegroundColor Red
    Write-Host "右键点击 PowerShell 并选择 '以管理员身份运行'" -ForegroundColor Yellow
    exit 1
}

# 检查是否已安装
if (Test-Path "$InstallDir\redis-server.exe") {
    Write-Host "Redis 已经安装在 $InstallDir" -ForegroundColor Yellow
    $response = Read-Host "是否要重新安装? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "安装已取消" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "安装配置:" -ForegroundColor Green
Write-Host "  安装目录: $InstallDir" -ForegroundColor White
Write-Host "  数据目录: $DataDir" -ForegroundColor White
Write-Host "  端口: $Port" -ForegroundColor White
Write-Host ""

# 创建目录
Write-Host "创建安装目录..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null

# 下载 Redis
Write-Host "下载 Redis..." -ForegroundColor Cyan
$redisVersion = "5.0.14.1"
$downloadUrl = "https://github.com/tporadowski/redis/releases/download/v$redisVersion/Redis-x64-$redisVersion.zip"
$zipFile = "$env:TEMP\redis.zip"

try {
    Write-Host "正在从 GitHub 下载 Redis $redisVersion..." -ForegroundColor Yellow
    Write-Host "下载地址: $downloadUrl" -ForegroundColor Gray
    
    # 使用 .NET WebClient 下载
    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($downloadUrl, $zipFile)
    
    Write-Host "✓ 下载完成" -ForegroundColor Green
} catch {
    Write-Host "✗ 下载失败: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "请手动下载 Redis:" -ForegroundColor Yellow
    Write-Host "1. 访问: https://github.com/tporadowski/redis/releases" -ForegroundColor White
    Write-Host "2. 下载最新的 Redis-x64-*.zip 文件" -ForegroundColor White
    Write-Host "3. 解压到: $InstallDir" -ForegroundColor White
    exit 1
}

# 解压
Write-Host "解压 Redis..." -ForegroundColor Cyan
try {
    Expand-Archive -Path $zipFile -DestinationPath $InstallDir -Force
    Write-Host "✓ 解压完成" -ForegroundColor Green
} catch {
    Write-Host "✗ 解压失败: $_" -ForegroundColor Red
    exit 1
}

# 清理下载文件
Remove-Item $zipFile -Force -ErrorAction SilentlyContinue

# 配置 Redis
Write-Host "配置 Redis..." -ForegroundColor Cyan
$configFile = "$InstallDir\redis.windows.conf"

if (Test-Path $configFile) {
    # 备份原配置
    Copy-Item $configFile "$configFile.backup" -Force
    
    # 读取配置
    $config = Get-Content $configFile
    
    # 修改配置
    $config = $config -replace "^dir .*", "dir $($DataDir -replace '\\', '/')"
    $config = $config -replace "^# bind 127.0.0.1", "bind 127.0.0.1"
    $config = $config -replace "^port .*", "port $Port"
    
    # 保存配置
    $config | Set-Content $configFile
    
    Write-Host "✓ 配置文件已更新" -ForegroundColor Green
} else {
    Write-Host "警告: 配置文件不存在，使用默认配置" -ForegroundColor Yellow
}

# 安装为 Windows 服务
Write-Host "安装 Redis 服务..." -ForegroundColor Cyan
try {
    # 停止并删除旧服务（如果存在）
    $service = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "停止现有 Redis 服务..." -ForegroundColor Yellow
        Stop-Service -Name "Redis" -Force -ErrorAction SilentlyContinue
        & "$InstallDir\redis-server.exe" --service-uninstall
        Start-Sleep -Seconds 2
    }
    
    # 安装新服务
    if (Test-Path $configFile) {
        & "$InstallDir\redis-server.exe" --service-install $configFile --service-name Redis --loglevel verbose
    } else {
        & "$InstallDir\redis-server.exe" --service-install --service-name Redis --loglevel verbose
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Redis 服务安装成功" -ForegroundColor Green
    } else {
        Write-Host "✗ Redis 服务安装失败" -ForegroundColor Red
    }
    
    # 启动服务
    Write-Host "启动 Redis 服务..." -ForegroundColor Cyan
    & "$InstallDir\redis-server.exe" --service-start
    Start-Sleep -Seconds 3
    
    $service = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        Write-Host "✓ Redis 服务已启动" -ForegroundColor Green
    } else {
        Write-Host "✗ Redis 服务启动失败" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ 服务安装失败: $_" -ForegroundColor Red
}

# 添加到 PATH
Write-Host "配置环境变量..." -ForegroundColor Cyan
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($currentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$currentPath;$InstallDir",
        "Machine"
    )
    Write-Host "✓ 已添加 Redis 到系统 PATH" -ForegroundColor Green
}

# 刷新当前会话的环境变量
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 验证安装
Write-Host ""
Write-Host "验证安装..." -ForegroundColor Cyan

try {
    $version = & "$InstallDir\redis-server.exe" --version
    Write-Host "✓ Redis 版本: $version" -ForegroundColor Green
} catch {
    Write-Host "✗ 无法验证 Redis 安装" -ForegroundColor Red
}

# 测试连接
Write-Host "测试 Redis 连接..." -ForegroundColor Cyan
Start-Sleep -Seconds 2

try {
    $result = & "$InstallDir\redis-cli.exe" ping 2>&1
    if ($result -eq "PONG") {
        Write-Host "✓ Redis 连接成功" -ForegroundColor Green
    } else {
        Write-Host "✗ Redis 连接失败" -ForegroundColor Red
        Write-Host "响应: $result" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Redis 连接测试失败: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Redis 安装完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "安装信息:" -ForegroundColor Cyan
Write-Host "  安装目录: $InstallDir" -ForegroundColor White
Write-Host "  数据目录: $DataDir" -ForegroundColor White
Write-Host "  端口: $Port" -ForegroundColor White
Write-Host "  服务名称: Redis" -ForegroundColor White
Write-Host ""
Write-Host "服务管理命令:" -ForegroundColor Cyan
Write-Host "  启动服务: Start-Service Redis" -ForegroundColor White
Write-Host "  停止服务: Stop-Service Redis" -ForegroundColor White
Write-Host "  查看状态: Get-Service Redis" -ForegroundColor White
Write-Host ""
Write-Host "下一步:" -ForegroundColor Cyan
Write-Host "1. 重启 PowerShell 以使环境变量生效" -ForegroundColor White
Write-Host "2. 运行 'redis-cli ping' 测试连接" -ForegroundColor White
Write-Host "3. 运行 'redis-cli' 进入交互式命令行" -ForegroundColor White
Write-Host ""
