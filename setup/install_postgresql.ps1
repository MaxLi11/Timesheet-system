# PostgreSQL 自动安装脚本
# 安装路径: D:\dev\postgresql
# 数据路径: D:\dev\data\postgresql

param(
    [string]$InstallDir = "D:\dev\postgresql",
    [string]$DataDir = "D:\dev\data\postgresql",
    [string]$Password = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL 安装脚本" -ForegroundColor Cyan
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
if (Test-Path "$InstallDir\bin\psql.exe") {
    Write-Host "PostgreSQL 已经安装在 $InstallDir" -ForegroundColor Yellow
    $response = Read-Host "是否要重新安装? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "安装已取消" -ForegroundColor Yellow
        exit 0
    }
}

# 获取密码
if ([string]::IsNullOrEmpty($Password)) {
    Write-Host "请设置 PostgreSQL 超级用户 (postgres) 的密码:" -ForegroundColor Yellow
    $SecurePassword = Read-Host "密码" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    
    if ([string]::IsNullOrEmpty($Password)) {
        Write-Host "错误: 密码不能为空" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "安装配置:" -ForegroundColor Green
Write-Host "  安装目录: $InstallDir" -ForegroundColor White
Write-Host "  数据目录: $DataDir" -ForegroundColor White
Write-Host "  端口: 5432" -ForegroundColor White
Write-Host ""

# 创建目录
Write-Host "创建安装目录..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null

# 检查 Chocolatey
Write-Host "检查 Chocolatey..." -ForegroundColor Cyan
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Chocolatey 未安装，正在安装..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    # 刷新环境变量
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# 安装 PostgreSQL
Write-Host "正在安装 PostgreSQL..." -ForegroundColor Cyan
Write-Host "这可能需要几分钟时间，请耐心等待..." -ForegroundColor Yellow

$chocoParams = "/Password:$Password /Port:5432 /InstallDir:$InstallDir /DataDir:$DataDir /ServiceName:postgresql /Locale:Chinese_China.936"

try {
    choco install postgresql16 --params $chocoParams -y --force
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "警告: Chocolatey 安装可能遇到问题" -ForegroundColor Yellow
        Write-Host "请手动下载并安装 PostgreSQL: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "手动安装步骤:" -ForegroundColor Cyan
        Write-Host "1. 下载 PostgreSQL 16.x 安装程序" -ForegroundColor White
        Write-Host "2. 运行安装程序" -ForegroundColor White
        Write-Host "3. 安装路径设置为: $InstallDir" -ForegroundColor White
        Write-Host "4. 数据目录设置为: $DataDir" -ForegroundColor White
        Write-Host "5. 端口设置为: 5432" -ForegroundColor White
        Write-Host "6. 设置超级用户密码" -ForegroundColor White
        exit 1
    }
} catch {
    Write-Host "错误: 安装失败 - $_" -ForegroundColor Red
    Write-Host "请尝试手动安装 PostgreSQL" -ForegroundColor Yellow
    exit 1
}

# 等待服务启动
Write-Host "等待 PostgreSQL 服务启动..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# 添加到 PATH
Write-Host "配置环境变量..." -ForegroundColor Cyan
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($currentPath -notlike "*$InstallDir\bin*") {
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$currentPath;$InstallDir\bin",
        "Machine"
    )
    Write-Host "已添加 PostgreSQL 到系统 PATH" -ForegroundColor Green
}

# 刷新当前会话的环境变量
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 验证安装
Write-Host ""
Write-Host "验证安装..." -ForegroundColor Cyan

try {
    $version = & "$InstallDir\bin\psql.exe" --version
    Write-Host "✓ PostgreSQL 版本: $version" -ForegroundColor Green
} catch {
    Write-Host "✗ 无法验证 PostgreSQL 安装" -ForegroundColor Red
    exit 1
}

# 测试连接
Write-Host "测试数据库连接..." -ForegroundColor Cyan
$env:PGPASSWORD = $Password

try {
    $result = & "$InstallDir\bin\psql.exe" -U postgres -h localhost -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 数据库连接成功" -ForegroundColor Green
    } else {
        Write-Host "✗ 数据库连接失败" -ForegroundColor Red
        Write-Host "错误信息: $result" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ 数据库连接测试失败: $_" -ForegroundColor Red
}

Remove-Item Env:\PGPASSWORD

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL 安装完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "安装信息:" -ForegroundColor Cyan
Write-Host "  安装目录: $InstallDir" -ForegroundColor White
Write-Host "  数据目录: $DataDir" -ForegroundColor White
Write-Host "  端口: 5432" -ForegroundColor White
Write-Host "  超级用户: postgres" -ForegroundColor White
Write-Host ""
Write-Host "下一步:" -ForegroundColor Cyan
Write-Host "1. 重启 PowerShell 以使环境变量生效" -ForegroundColor White
Write-Host "2. 运行 'psql -U postgres -h localhost' 测试连接" -ForegroundColor White
Write-Host "3. 创建项目数据库: CREATE DATABASE feishu_timesheet;" -ForegroundColor White
Write-Host ""
Write-Host "注意: 请妥善保管数据库密码!" -ForegroundColor Yellow
