# 开发环境安装脚本

本目录包含飞书工时管理系统开发环境的自动化安装脚本。

## 📋 目录结构

```
setup/
├── README.md                    # 本文件
├── SETUP_GUIDE.md              # 详细安装指南
├── quick_start.ps1             # 一键安装脚本（推荐）
├── install_postgresql.ps1      # PostgreSQL 安装脚本
├── install_redis.ps1           # Redis 安装脚本
└── verify_environment.ps1      # 环境验证脚本
```

## 🚀 快速开始

### 方法一：一键安装（推荐）

1. **以管理员身份运行 PowerShell**
   - 右键点击 PowerShell
   - 选择"以管理员身份运行"

2. **导航到项目目录**
   ```powershell
   cd D:\Antigravity\Project-timesheet
   ```

3. **运行快速安装脚本**
   ```powershell
   .\setup\quick_start.ps1
   ```

4. **按照提示完成安装**
   - 设置 PostgreSQL 密码
   - 等待安装完成
   - 重启 PowerShell

### 方法二：分步安装

如果需要更多控制，可以单独运行各个安装脚本：

#### 1. 安装 PostgreSQL
```powershell
.\setup\install_postgresql.ps1
```

可选参数：
```powershell
.\setup\install_postgresql.ps1 -InstallDir "D:\dev\postgresql" -DataDir "D:\dev\data\postgresql" -Password "your_password"
```

#### 2. 安装 Redis
```powershell
.\setup\install_redis.ps1
```

可选参数：
```powershell
.\setup\install_redis.ps1 -InstallDir "D:\dev\redis" -DataDir "D:\dev\data\redis" -Port 6379
```

#### 3. 验证安装
```powershell
.\setup\verify_environment.ps1
```

## ✅ 验证安装

安装完成后，运行验证脚本检查所有组件：

```powershell
.\setup\verify_environment.ps1
```

预期输出：
```
检查 Python...
  ✓ Python 3.12.10 (满足 3.9+ 要求)
检查 pip...
  ✓ pip 24.x.x
检查 Git...
  ✓ Git 2.53.0
检查 PostgreSQL...
  ✓ PostgreSQL 16.x
  ✓ 数据库连接成功
检查 Redis...
  ✓ Redis 5.x
  ✓ Redis 连接成功
```

## 📦 已安装的组件

### ✅ 预装组件
- **Python**: 3.12.10 ✓
- **Git**: 2.53.0 ✓

### 🔧 需要安装的组件
- **PostgreSQL**: 16.x (数据库)
- **Redis**: 5.x (缓存服务)

## 📍 安装路径

所有组件安装到 D 盘，避免占用 C 盘空间：

```
D:\dev\
├── postgresql\          # PostgreSQL 程序文件
├── redis\              # Redis 程序文件
└── data\
    ├── postgresql\     # PostgreSQL 数据文件
    └── redis\          # Redis 数据文件
```

## 🔍 手动安装

如果自动安装脚本遇到问题，请参考 `SETUP_GUIDE.md` 进行手动安装。

### PostgreSQL 手动安装
1. 下载: https://www.postgresql.org/download/windows/
2. 运行安装程序
3. 安装路径: `D:\dev\postgresql`
4. 数据目录: `D:\dev\data\postgresql`
5. 端口: 5432
6. 设置超级用户密码

### Redis 手动安装
1. 下载: https://github.com/tporadowski/redis/releases
2. 解压到: `D:\dev\redis`
3. 配置文件: `redis.windows.conf`
4. 安装服务: `redis-server.exe --service-install`
5. 启动服务: `redis-server.exe --service-start`

## 🛠️ 常用命令

### PostgreSQL
```powershell
# 连接数据库
psql -U postgres -h localhost

# 创建数据库
CREATE DATABASE feishu_timesheet;

# 创建用户
CREATE USER timesheet_user WITH PASSWORD 'your_password';

# 授权
GRANT ALL PRIVILEGES ON DATABASE feishu_timesheet TO timesheet_user;

# 查看数据库列表
\l

# 退出
\q
```

### Redis
```powershell
# 测试连接
redis-cli ping

# 进入交互式命令行
redis-cli

# 设置值
set key value

# 获取值
get key

# 退出
exit
```

### 服务管理
```powershell
# 查看服务状态
Get-Service postgresql*
Get-Service Redis

# 启动服务
Start-Service postgresql-x64-16
Start-Service Redis

# 停止服务
Stop-Service postgresql-x64-16
Stop-Service Redis

# 重启服务
Restart-Service postgresql-x64-16
Restart-Service Redis
```

## ❗ 故障排除

### 问题 1: 脚本执行策略错误

**错误信息**: "无法加载文件，因为在此系统上禁止运行脚本"

**解决方案**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 问题 2: PostgreSQL 服务无法启动

**解决方案**:
```powershell
# 查看日志
Get-Content D:\dev\data\postgresql\log\*.log -Tail 50

# 检查端口占用
netstat -ano | findstr :5432

# 手动启动服务
Start-Service postgresql-x64-16
```

### 问题 3: Redis 连接失败

**解决方案**:
```powershell
# 检查服务状态
Get-Service Redis

# 启动服务
Start-Service Redis

# 测试配置
redis-server D:\dev\redis\redis.windows.conf --test-memory 1024
```

### 问题 4: 权限不足

**解决方案**:
- 确保以管理员身份运行 PowerShell
- 右键点击 PowerShell → "以管理员身份运行"

### 问题 5: 网络连接问题

**解决方案**:
- 检查网络连接
- 使用 VPN 或代理（如果在国内）
- 手动下载安装包

## 📚 相关文档

- [完整安装指南](SETUP_GUIDE.md) - 详细的安装步骤和配置说明
- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [Redis 官方文档](https://redis.io/documentation)
- [Python 官方文档](https://docs.python.org/3/)

## 🔐 安全建议

1. **PostgreSQL**
   - 使用强密码（至少 12 位，包含大小写字母、数字和特殊字符）
   - 仅允许本地连接（127.0.0.1）
   - 定期备份数据库

2. **Redis**
   - 配置密码保护（在 redis.conf 中设置 requirepass）
   - 绑定到 127.0.0.1（仅本地访问）
   - 禁用危险命令（FLUSHDB, FLUSHALL, CONFIG）

3. **开发环境**
   - 不要在生产环境使用开发配置
   - 定期更新软件版本
   - 使用虚拟环境隔离 Python 依赖

## 📞 获取帮助

如果遇到问题：

1. 查看 `SETUP_GUIDE.md` 中的故障排除部分
2. 运行 `verify_environment.ps1` 检查环境状态
3. 查看安装日志和错误信息
4. 参考官方文档

## 下一步

环境安装完成后，请继续：

1. ✅ **任务 1**: 开发环境搭建（当前任务）
2. ⏭️ **任务 2**: 项目结构初始化
3. ⏭️ **任务 3**: 安装核心依赖包
4. ⏭️ **任务 4**: 配置管理系统

---

**注意**: 所有脚本都设计为安装到 D 盘，避免占用 C 盘空间。如需修改安装路径，请编辑脚本中的参数。
