# 飞书工时管理系统 - 开发环境搭建指南

## 环境检查结果

### ✅ 已安装的组件
- **Python**: 3.12.10 (满足 3.9+ 要求)
- **Git**: 2.53.0.windows.1

### ❌ 需要安装的组件
- **PostgreSQL**: 数据库服务
- **Redis**: 缓存服务

## 安装路径规划

所有组件将安装到 D 盘，避免占用 C 盘空间：

```
D:\dev\
├── postgresql\          # PostgreSQL 安装目录
├── redis\              # Redis 安装目录
└── data\
    ├── postgresql\     # PostgreSQL 数据目录
    └── redis\          # Redis 数据目录
```

## 安装步骤

### 1. PostgreSQL 安装

#### 方法一：使用安装程序（推荐）

1. **下载 PostgreSQL**
   - 访问: https://www.postgresql.org/download/windows/
   - 下载最新的 PostgreSQL 16.x 版本
   - 或直接下载: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

2. **运行安装程序**
   ```
   - 安装路径: D:\dev\postgresql
   - 数据目录: D:\dev\data\postgresql
   - 端口: 5432 (默认)
   - 超级用户密码: 请设置一个强密码并记住
   - 区域设置: Chinese, China (或 Default locale)
   ```

3. **验证安装**
   ```powershell
   # 将 PostgreSQL 添加到 PATH (临时)
   $env:Path += ";D:\dev\postgresql\bin"
   
   # 检查版本
   psql --version
   
   # 测试连接
   psql -U postgres -h localhost
   ```

#### 方法二：使用 Chocolatey（命令行安装）

```powershell
# 安装 Chocolatey (如果未安装)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 安装 PostgreSQL 到 D 盘
choco install postgresql16 --params "/InstallDir:D:\dev\postgresql /DataDir:D:\dev\data\postgresql" -y
```

### 2. Redis 安装

#### 方法一：使用预编译版本（推荐）

1. **下载 Redis for Windows**
   - 访问: https://github.com/tporadowski/redis/releases
   - 下载最新的 Redis-x64-*.zip 文件

2. **解压到 D 盘**
   ```powershell
   # 创建目录
   New-Item -ItemType Directory -Path "D:\dev\redis" -Force
   
   # 解压下载的 zip 文件到 D:\dev\redis
   # (使用 Windows 资源管理器或 7-Zip)
   ```

3. **配置 Redis**
   ```powershell
   # 编辑 D:\dev\redis\redis.windows.conf
   # 修改以下配置:
   # dir D:/dev/data/redis
   # bind 127.0.0.1
   # port 6379
   ```

4. **安装为 Windows 服务**
   ```powershell
   cd D:\dev\redis
   .\redis-server.exe --service-install redis.windows.conf --service-name Redis
   .\redis-server.exe --service-start
   ```

#### 方法二：使用 Chocolatey

```powershell
# 安装 Redis
choco install redis-64 -y

# 手动移动到 D 盘 (Chocolatey 默认安装到 C 盘)
# 需要手动配置服务路径
```

### 3. 配置环境变量

将工具添加到系统 PATH，方便命令行使用：

```powershell
# 以管理员身份运行 PowerShell

# 添加 PostgreSQL 到 PATH
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "Machine") + ";D:\dev\postgresql\bin",
    "Machine"
)

# 添加 Redis 到 PATH
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "Machine") + ";D:\dev\redis",
    "Machine"
)

# 重启 PowerShell 使环境变量生效
```

### 4. 创建项目数据库

```powershell
# 连接到 PostgreSQL
psql -U postgres -h localhost

# 在 psql 命令行中执行:
CREATE DATABASE feishu_timesheet;
CREATE USER timesheet_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE feishu_timesheet TO timesheet_user;
\q
```

### 5. 测试 Redis 连接

```powershell
# 启动 Redis CLI
redis-cli

# 在 redis-cli 中测试:
ping
# 应该返回: PONG

set test "Hello Redis"
get test
# 应该返回: "Hello Redis"

exit
```

## 验证安装

运行以下命令验证所有组件正常工作：

```powershell
# 检查 Python
python --version
# 预期输出: Python 3.12.10

# 检查 Git
git --version
# 预期输出: git version 2.53.0.windows.1

# 检查 PostgreSQL
psql --version
# 预期输出: psql (PostgreSQL) 16.x

# 检查 Redis
redis-server --version
# 预期输出: Redis server v=x.x.x

# 测试 PostgreSQL 连接
psql -U postgres -h localhost -c "SELECT version();"

# 测试 Redis 连接
redis-cli ping
# 预期输出: PONG
```

## 开发工具配置

### 推荐的 IDE

1. **Visual Studio Code**
   - 下载: https://code.visualstudio.com/
   - 安装路径: D:\dev\VSCode (可选)
   - 推荐扩展:
     - Python
     - PostgreSQL
     - Redis
     - GitLens

2. **PyCharm Community Edition**
   - 下载: https://www.jetbrains.com/pycharm/download/
   - 安装路径: D:\dev\PyCharm (可选)

### Git 配置

```powershell
# 配置用户信息
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 配置默认编辑器
git config --global core.editor "code --wait"

# 配置换行符处理
git config --global core.autocrlf true
```

## 下一步

环境搭建完成后，请继续执行：
- 任务 2: 项目结构初始化
- 任务 3: 安装核心依赖包

## 故障排除

### PostgreSQL 无法启动

```powershell
# 检查服务状态
Get-Service postgresql*

# 手动启动服务
Start-Service postgresql-x64-16

# 查看日志
Get-Content D:\dev\data\postgresql\log\*.log -Tail 50
```

### Redis 无法启动

```powershell
# 检查服务状态
Get-Service Redis

# 手动启动服务
Start-Service Redis

# 测试配置文件
redis-server D:\dev\redis\redis.windows.conf --test-memory 1024
```

### 端口冲突

```powershell
# 检查端口占用
netstat -ano | findstr :5432  # PostgreSQL
netstat -ano | findstr :6379  # Redis

# 如果端口被占用，可以修改配置文件中的端口号
```

## 安全建议

1. **PostgreSQL**
   - 使用强密码
   - 限制远程访问（仅本地开发）
   - 定期备份数据

2. **Redis**
   - 配置密码保护
   - 绑定到 127.0.0.1（仅本地访问）
   - 禁用危险命令

3. **开发环境**
   - 不要在生产环境使用开发配置
   - 定期更新软件版本
   - 使用虚拟环境隔离 Python 依赖

## 参考资源

- PostgreSQL 官方文档: https://www.postgresql.org/docs/
- Redis 官方文档: https://redis.io/documentation
- Python 官方文档: https://docs.python.org/3/
- Git 官方文档: https://git-scm.com/doc
