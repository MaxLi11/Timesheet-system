# Feishu Timesheet Sync Service

飞书工时管理自动化系统 - 中间服务层

## 项目简介

这是一个连接飞书平台和现有工时管理网站的中间服务，实现工时数据的自动化同步和审批流程管理。

## 功能特性

- 📝 从飞书多维表格读取工时数据
- ✅ 自动化审批流程（部门负责人 → 项目经理）
- 🔄 定期自动同步到网站后端
- 📊 数据验证和转换
- 🔔 飞书消息通知
- 📅 假期和标准工时管理

## 技术栈

- **Web Framework**: FastAPI
- **Database**: SQLite (开发) / PostgreSQL (生产)
- **Task Scheduler**: APScheduler
- **Feishu SDK**: lark-oapi
- **Testing**: pytest + hypothesis

## 项目结构

```
feishu_service/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 应用入口
│   ├── config.py            # 配置管理
│   ├── models/              # 数据模型
│   │   ├── __init__.py
│   │   ├── timesheet.py
│   │   ├── project.py
│   │   └── holiday.py
│   ├── services/            # 业务服务
│   │   ├── __init__.py
│   │   ├── feishu_client.py
│   │   ├── validation.py
│   │   ├── approval.py
│   │   └── sync.py
│   ├── api/                 # API 路由
│   │   ├── __init__.py
│   │   └── routes.py
│   └── utils/               # 工具函数
│       ├── __init__.py
│       ├── logger.py
│       └── database.py
├── tests/                   # 测试文件
│   ├── __init__.py
│   ├── test_models.py
│   ├── test_services.py
│   └── test_api.py
├── config/                  # 配置文件
│   ├── config.yaml
│   └── config.example.yaml
├── logs/                    # 日志目录
├── .env.example             # 环境变量示例
├── .gitignore
├── requirements.txt
└── README.md
```

## 快速开始

### 1. 创建虚拟环境

```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux/Mac
python -m venv venv
source venv/bin/activate
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置环境变量

```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env 文件，填入飞书应用配置
```

### 4. 运行服务

```bash
# 开发模式
uvicorn app.main:app --reload --port 8001

# 生产模式
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## 配置说明

### 飞书应用配置

1. 在飞书开放平台创建应用
2. 获取 App ID 和 App Secret
3. 配置应用权限（多维表格读写、消息发送）
4. 在 `.env` 文件中配置

### 数据库配置

开发环境使用 SQLite：
```
DATABASE_URL=sqlite:///./feishu_timesheet.db
```

生产环境使用 PostgreSQL：
```
DATABASE_URL=postgresql://user:password@localhost:5432/feishu_timesheet
```

## API 文档

启动服务后访问：
- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

## 测试

```bash
# 运行所有测试
pytest

# 运行测试并查看覆盖率
pytest --cov=app tests/

# 运行特定测试文件
pytest tests/test_models.py -v
```

## 开发指南

### 代码风格

使用 Black 格式化代码：
```bash
black app/ tests/
```

使用 Flake8 检查代码：
```bash
flake8 app/ tests/
```

使用 MyPy 类型检查：
```bash
mypy app/
```

### 提交规范

遵循 Conventional Commits 规范：
- `feat:` 新功能
- `fix:` 修复bug
- `docs:` 文档更新
- `test:` 测试相关
- `refactor:` 代码重构
- `chore:` 其他修改

## 部署

### Docker 部署

```bash
# 构建镜像
docker build -t feishu-service .

# 运行容器
docker run -d -p 8001:8001 --env-file .env feishu-service
```

### 系统服务

使用 systemd 管理服务（Linux）：
```bash
sudo cp feishu-service.service /etc/systemd/system/
sudo systemctl enable feishu-service
sudo systemctl start feishu-service
```

## 监控和日志

- 日志文件位置：`logs/`
- 日志格式：JSON 结构化日志
- 日志级别：DEBUG, INFO, WARNING, ERROR

## 故障排除

### 常见问题

1. **飞书 API 调用失败**
   - 检查 App ID 和 App Secret 是否正确
   - 检查应用权限是否配置完整
   - 查看日志文件获取详细错误信息

2. **数据库连接失败**
   - 检查 DATABASE_URL 配置
   - 确认数据库服务正在运行
   - 检查数据库用户权限

3. **定时任务未执行**
   - 检查 APScheduler 配置
   - 查看日志确认任务是否被调度
   - 确认服务器时区设置正确

## 相关文档

- [需求文档](../.kiro/specs/feishu-timesheet-sync/requirements.md)
- [设计文档](../.kiro/specs/feishu-timesheet-sync/design.md)
- [任务清单](../.kiro/specs/feishu-timesheet-sync/tasks.md)
- [飞书开放平台文档](https://open.feishu.cn/document/)

## 许可证

本项目仅供内部使用。

## 联系方式

如有问题，请联系项目维护者。
