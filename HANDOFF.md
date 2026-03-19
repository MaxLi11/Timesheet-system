# Anx Showtime 项目交接文档

最后更新时间: 2026-03-17

本文档基于当前仓库代码、测试文件、本地 `git` 状态和本地验证整理而成。
写法原则:

- 优先记录“代码里能确认的事实”
- 对少量带判断性质的内容，会明确标注为“推断/建议”

## 0. 建议接手顺序

建议下一位 Claude / 开发者先读以下文件：

1. `HANDOFF.md`
2. `backend/main.py`
3. `backend/crud.py`
4. `backend/parser.py`
5. `backend/database.py`
6. `frontend/src/App.jsx`
7. `frontend/src/utils/dataHelper.js`
8. `tests/test_project_schedule_feature.py`
9. `tests/test_project_schedule_frontend.py`
10. `tests/test_frontend_style_density.py`

接手前需要先知道的重点：

- 当前主线功能是“项目节点进度监控”的前端二次优化
- 后端接口和数据口径已经落地
- 自动测试和 `npm run build` 已通过
- 但用户最后一次人工反馈仍认为图表存在错位，所以 UI 视觉验收还没有最终关闭
- 用户希望 Git 与 Hugging Face 内容尽量一致
- 用户明确要求尽量不要往 `C:` 盘写入新的内容

## 1. 当前开发上下文

### 1.1 当前正在开发的功能/任务

当前主线功能为：

- 项目分析页中的“项目节点进度监控”功能
- 该功能已完成后端、数据解析、接口、前端渲染和基础测试
- 当前处于前端二次优化阶段，重点是布局、筛选器交互和图表可读性

### 1.2 当前完成状态

按模块看：

- 后端解析与接口：已完成
- 数据库存储：已完成
- 前端功能接入：已完成
- 自动化测试：已完成并通过
- 最终 UI 验收：未完成

可以粗略理解为：

- 代码完成度约 `85% ~ 90%`
- 功能逻辑已成型
- 主要剩余风险集中在用户视觉体验层

### 1.3 最后一次开发的具体内容

最近一轮修改主要围绕“项目节点进度监控”图表和筛选器：

- 修复了项目筛选器的 `ref` 绑定错误
- 让项目筛选器使用 `pointerdown + 外部点击关闭`，避免面板内点击误关闭
- 将项目筛选按钮放到“项目节点进度监控”右侧
- 对图例位置做了调整
- 将单个项目图表高度提高到 `560px`
- 统一上下两个 ECharts grid 的 `right` 值为 `132`
- 增大 milestone 区域高度，缓解节点名和日期的拥挤问题

### 1.4 当前下一步建议

建议下一步按这个顺序继续：

1. 在浏览器里手动验证“单项目”和“8 个项目全选”两种场景
2. 重点查看图表是否仍然错位、是否有异常留白、是否出现无法滚动的问题
3. 如果视觉确认通过，再提交当前前端改动并同步到 Git / Hugging Face
4. 如果仍错位，继续只调整 `frontend/src/App.jsx` 中项目进度监控图的 `grid / legend / axisLabel / height` 配置，不要先动后端

### 1.5 当前分支与提交状态

当前分支：

- `main`

远程分支：

- `origin/main`

最近提交记录：

- `a02019e fix: restore hugging face deployment config`
- `a726eac feat: add project schedule monitoring`
- `0f5c42c feat: add dashboard granularity toggle`
- `aaee0a3 fix: tighten dashboard density and remove gantt tab`
- `2730d9c feat: refresh frontend with light productized UI`

当前未提交改动：

- `frontend/package-lock.json`
- `frontend/src/App.jsx`
- `frontend/src/index.css`
- `tests/test_frontend_style_density.py`
- `tests/test_project_schedule_frontend.py`

当前本地临时文件：

- `.tmp-logs/`
- `current_ip.txt`
- `Timesheet Report-20260316104428.xlsx`

## 2. 待办事项清单

### 2.1 未完成的功能需求

- [ ] 完成“项目节点进度监控”图表的最终视觉验收
- [ ] 决定是否要提交当前 `frontend/package-lock.json` 的变化
- [ ] 解决 Hugging Face 部署链路中 `timesheet.db` 依赖不稳定的问题
- [ ] 决定是否保留旧的 `setup_ip.py / 快速启动.bat` 本地 IP 注入方案
- [ ] 评估是否拆分 `frontend/src/App.jsx`

### 2.2 已知 bug / 风险

- 用户最后一次人工反馈是：项目节点进度监控图表“完全错位了”
- 代码虽然已经做了一轮修复，但还没有拿到最终人工确认
- Hugging Face 手动同步说明中写的是“不上传 `timesheet.db`”，但实际根目录 `Dockerfile` 里有 `COPY timesheet.db .`
- 如果在一个全新的 Hugging Face Space 中直接从 Git 仓库构建，缺少 `timesheet.db` 时可能构建失败
- `setup_ip.py` 会直接改写 `frontend/src/App.jsx` 的 `API_BASE_URL`，和当前正式环境变量方案冲突
- 仓库里存在少量中文编码痕迹，容易误读文案或字段名

### 2.3 计划中的优化项

- 前端打包体积偏大，`vite build` 仍有 chunk size warning
- `App.jsx` 过大，前端结构耦合严重
- Reporting / Approval 当前命名更接近“差异分析”和“待审批汇总”，并非严格百分比 rate
- 目前缺少真正的浏览器级 E2E 或截图回归

### 2.4 用户反馈过的问题

用户已明确提出过的反馈包括：

- 字体过大，显示笨拙
- 一些文案会换行
- 文本和筛选框不对齐
- 筛选框偏大
- 页面风格过于朴素，希望更接近轻产品化 SaaS 风格
- 需要按月份而不是默认季度看工时
- Gantt 页不需要
- 需要 Git 与 Hugging Face 保持一致
- 尽量不要往 `C:` 盘增加内容

## 3. 业务逻辑文档

### 3.1 工时 Excel 文件结构

解析位置：

- `backend/parser.py` 中的 `parse_timesheet`

读取方式：

- 读取第一个 sheet

必填列：

- `员工`
- `所属部门`
- `工号`
- `开始日期`
- `结束日期`

业务列：

- `项目名称(新)`
- `项目名称(作废)`
- `非项目名称`
- `合计`
- `任务详情`
- `核准状态`
- `当前节点`
- `未操作者`

注意：

- Excel 中有两个同名 `合计` 列
- 代码会自动重命名为：
  - `合计_项目`
  - `合计_非项目`

### 3.2 工时 Excel 的数据处理规则

项目归属规则：

1. 优先使用 `项目名称(新)`
2. 若为空，则使用 `项目名称(作废)`
3. 若仍为空，则使用 `非项目名称`
4. 三者都没有时，该行跳过

分类规则：

- 若落到项目名称列，`category = Project`
- 若落到非项目列，`category = Non-Project`

跳过规则：

- `员工` 为空
- 工时为空
- 工时为 `0`
- 日期无法解析

日期规则：

- 使用 `开始日期` 和 `结束日期`
- 支持 Excel 日期和 `%Y-%m-%d` 字符串日期

部门简称映射规则：

- 优先使用 `backend/parser.py` 中的 `DEFAULT_DEPT_MAPPING`
- 如果本地存在 `部门简称.xlsx`，则读取其 `Sheet1`
- 使用 `部门 -> 部门简称` 覆盖默认映射

### 3.3 项目进度表结构

解析位置：

- `backend/parser.py` 中的 `parse_project_schedule`

解析规则：

- 只支持工作表 `Schedule`
- `header=2`，即 Excel 第 3 行作为表头
- 每个项目固定占 3 行：
  - `MRD plan`
  - `Actual/Outlook`
  - `Delta`

项目级列：

- `BU`
- `Project Name`
- `Status`
- `Unnamed: 4` 作为行类型列
- `Unnamed: 30` 作为总周期列

固定 milestone 列：

- `Pre-Gate0`
- `Gate0（kick off)`
- `Gate1(Initial PRD)`
- `Design Review 1`
- `Final PRD`
- `RTL freeze`
- `Tape out 1`
- `Fab out 1`
- `BS/1st silicon`
- `Tape out 2`
- `Fab out2`
- `ES/2nd silicon`
- `ATE for MP ready`
- `Validation done`
- `CS`
- `RTP`

### 3.4 主看板工时统计口径

接口：

- `GET /stats`

规则：

- 只统计 `current_node == Close` 的工时
- 比较时使用 `lower(current_node) == 'close'`

说明：

- 这是当前系统最关键的工时统计口径
- 用户曾手算 `Walnut2` 后发现差异，最终已确认系统应该按 `Close` 口径计算

### 3.5 填报率计算规则

接口：

- `GET /reporting-rate`

实际含义：

- 当前“完整填报率”页面并不是返回百分比
- 实现上更接近“应填与实填差额分析”

后端规则：

- 返回所有记录时，会排除 `approval_status == 未提交 Not Submitted` 的行

前端计算规则：

位置：

- `frontend/src/utils/dataHelper.js` 中 `computeReportingRate`

核心公式：

- `actual_hours = 选定周期内某员工 hours 求和`
- `gap = targetHours - actual_hours`

展示规则：

- 只展示 `gap != 0` 的记录
- `gap > 0` 表示少填
- `gap < 0` 表示超填

周期规则：

- 年视图下，按月聚合
- 月视图下，按月聚合
- 周视图下，按周聚合

### 3.6 审批率计算规则

接口：

- `GET /approval-rate`

实际含义：

- 当前“审批完成率”页面也不是严格百分比
- 更接近“待审批工时汇总”

后端规则：

- 排除 `current_node == Close`
- 排除 `current_node == Prepare`

前端规则：

位置：

- `frontend/src/utils/dataHelper.js` 中 `computeApprovalRate`

统计方式：

- 按 `pending_approver` 分组
- 统计：
  - `count`
  - `total_hours`

支持过滤：

- 年
- 月
- 项目多选
- approver 单选

### 3.7 项目节点进度监控逻辑

上传接口：

- `POST /upload-project-schedule`

读取接口：

- `GET /project-schedule-analysis`

数据替换规则：

- 每次上传新的项目进度表，会整表覆盖旧项目进度数据

返回字段至少包括：

- `projects[]`
- `project_name`
- `bu`
- `status`
- `mapped_timesheet_projects[]`
- `cycle_summary`
- `milestones[]`
- `intervals[]`

区间工时逻辑：

- 只统计 `Close` 口径工时
- 区间按相邻两个 milestone 的 `actual_date` 生成
- 只有相邻两个 milestone 都有实际日期时，该区间才有效
- 工时落入区间判定：
  - `start_date >= 当前节点实际日期`
  - `start_date < 下一节点实际日期`

### 3.8 特殊项目映射逻辑

特殊规则：

- 当进度项目名为 `Balsa3/Bamboo2` 时
- 默认映射到工时项目 `['Balsa3']`
- 如果工时表中未来出现 `Bamboo2`
- 则自动扩展为 `['Balsa3', 'Bamboo2']`

### 3.9 业务术语说明

- `current_node`: 当前流程节点，例如 `Prepare`、`Close`
- `Close`: 已完成审批，可进入主看板工时统计
- `Prepare`: 准备阶段，不进入待审批统计
- `approval_status`: 核准状态
- `pending_approver`: 当前待操作人/待审批人
- `delta_days`: 计划与实际的差值天数
- `mapped_timesheet_projects`: 项目进度项目名映射到工时系统中的项目名集合

## 4. 数据库 Schema

说明：

- ORM 模型定义在 `backend/database.py`
- 下方 SQL 是从当前本地 `timesheet.db` 实库读出的结果
- 需要注意：当前实库 schema 与 ORM 定义并非完全一致

### 4.1 CREATE TABLE 语句

```sql
CREATE TABLE employees (
    id INTEGER NOT NULL,
    name VARCHAR,
    employee_id VARCHAR,
    department VARCHAR,
    company VARCHAR,
    position VARCHAR,
    PRIMARY KEY (id)
);

CREATE TABLE time_entries (
    id INTEGER NOT NULL,
    employee_name VARCHAR,
    employee_id VARCHAR,
    project_name VARCHAR,
    category VARCHAR,
    start_date DATE,
    end_date DATE,
    hours FLOAT,
    task_details VARCHAR,
    approval_status VARCHAR,
    department TEXT,
    current_node TEXT,
    pending_approver TEXT,
    PRIMARY KEY (id)
);

CREATE TABLE project_schedules (
    id INTEGER NOT NULL,
    project_name VARCHAR NOT NULL,
    bu VARCHAR,
    status VARCHAR,
    project_order INTEGER NOT NULL,
    planned_days FLOAT,
    actual_days FLOAT,
    delta_days FLOAT,
    PRIMARY KEY (id)
);

CREATE TABLE project_schedule_milestones (
    id INTEGER NOT NULL,
    schedule_id INTEGER NOT NULL,
    milestone_name VARCHAR NOT NULL,
    milestone_order INTEGER NOT NULL,
    planned_date DATE,
    actual_date DATE,
    delta_days FLOAT,
    PRIMARY KEY (id),
    FOREIGN KEY(schedule_id) REFERENCES project_schedules (id)
);
```

### 4.2 当前索引信息

`employees`

- `ix_employees_id`
- `ix_employees_name`
- `ix_employees_employee_id`，唯一索引

`time_entries`

- `ix_time_entries_id`
- `ix_time_entries_employee_name`
- `ix_time_entries_employee_id`
- `ix_time_entries_project_name`

`project_schedules`

- `ix_project_schedules_id`
- `ix_project_schedules_project_name`

`project_schedule_milestones`

- `ix_project_schedule_milestones_id`
- `ix_project_schedule_milestones_schedule_id`

### 4.3 当前数据库层技术债

- ORM 中 `TimeEntry.department` 声明为 `String(index=True)`，但当前实际数据库没有对应索引
- `migrate_db.py` 只处理了 `department` 列的补充，不是完整迁移体系
- `employees` 表目前几乎没有参与主业务流程，更像早期保留模型

## 5. 开发约定

### 5.1 代码组织

- `backend/`：后端服务
- `frontend/`：前端页面
- `tests/`：Python `unittest`
- `docs/plans/`：设计和实施文档
- `deliverables/hf-manual-sync/`：Hugging Face 手动同步包输出目录

### 5.2 风格约定

当前项目没有一套单独的 lint + style guide 文档，但从仓库结构可以看出：

- 后端逻辑主要集中在 `backend/crud.py` 和 `backend/parser.py`
- 前端主逻辑几乎都在 `frontend/src/App.jsx`
- 样式集中在 `frontend/src/index.css`
- `App.css` 已经不再使用

### 5.3 Git commit message 约定

目前提交信息基本采用 Conventional Commits 风格：

- `feat: ...`
- `fix: ...`
- `chore: ...`

### 5.4 分支策略

当前实际使用方式：

- 主要在 `main` 上直接开发
- 远程只有 `origin/main`

没有发现固定的 feature branch 工作流。

### 5.5 用户偏好型约定

这是接手时必须重视的非代码约定：

- 尽量不要往 `C:` 盘写新内容
- npm cache 尽量使用 `D:\Antigravity\Project-timesheet\.npm-cache`
- Git 与 Hugging Face 要保持同步
- 不要随意提交本地临时文件、日志、Excel 样本

## 6. 技术决策记录

### 6.1 技术选型原因

当前技术栈：

- 后端：FastAPI + SQLAlchemy + SQLite
- 前端：React + Vite + ECharts
- Excel 解析：pandas + openpyxl
- 部署：Docker + Hugging Face Spaces

选择原因：

- 本地运行简单
- 便于上传 Excel 后做快速统计分析
- ECharts 适合复杂图表需求
- FastAPI 对这类轻量接口足够高效

### 6.2 已确定的核心业务决策

- 主看板总工时必须按 `Close` 口径
- 项目进度监控必须单独上传项目进度 Excel，不复用工时上传入口
- 项目进度监控采用“一项目一卡片一图”的展示方式
- 月/季粒度切换仅做前端聚合，不改后端接口
- 页面导航已从左侧 sidebar 改为顶部导航

### 6.3 已放弃或不再推进的方向

- `gantt` tab 已移除，不再是现行需求
- 不做假的搜索框
- 不把所有项目节点监控硬塞进同一张总图

### 6.4 性能相关策略

- 工时写库使用 `bulk_insert_mappings`
- 写入时分块，`CHUNK_SIZE = 5000`
- 上传工时时使用按 `(start_date, end_date)` 的滚动替换，而不是整库清空
- 图表聚合尽量放在前端，减少后端额外聚合接口

## 7. 部署配置

### 7.1 Hugging Face Spaces 配置

配置位置：

- 根目录 `README.md` 顶部 front matter

当前配置：

- `sdk: docker`
- 容器对外端口：`7860`

### 7.2 Docker 文件

主部署文件：

- `Dockerfile`

本地分离运行相关：

- `Dockerfile.backend`
- `Dockerfile.frontend`
- `docker-compose.yml`

### 7.3 主 Dockerfile 行为

主 Dockerfile 做的事情：

1. 使用 `node:22-slim` 构建前端
2. 通过 `npm install` 安装前端依赖
3. 运行 `npm run build`
4. 使用 `python:3.9-slim` 作为最终镜像
5. 安装 `nginx`
6. 安装 Python 依赖
7. 复制 `backend/`
8. 复制 `timesheet.db`
9. 将前端 `dist` 放入 nginx 静态目录
10. 通过 nginx 将 `/api/` 反代到 `localhost:8000`

### 7.4 环境变量

当前实际用到的环境变量：

- `DATABASE_URL`
  - 若存在，则连接外部 PostgreSQL
  - 若为 `postgres://`，代码会自动改写为 `postgresql://`
  - 若不存在，则默认使用本地 SQLite `timesheet.db`

- `VITE_API_URL`
  - 前端 API 基地址
  - 当前前端逻辑为：
    - 若设置 `VITE_API_URL`，则使用它
    - 否则开发环境使用 `http://127.0.0.1:8000`
    - 生产环境使用 `/api`

- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
  - 只在 Dockerfile 中出现，属于构建环境变量

### 7.5 部署风险点

这里有一个非常重要的问题：

- `timesheet.db` 被 `.gitignore` 忽略
- 但根目录 `Dockerfile` 明确有 `COPY timesheet.db .`

这意味着：

- 当前 Hugging Face Space 能跑，推测是因为 Space 仓库里手动已有这个文件
- 但若从纯 Git 仓库重新构建一个新的 Hugging Face Space，可能因为缺少 `timesheet.db` 而构建失败

因此接手后建议优先处理这个问题：

方案 A：

- 继续保留预置 `timesheet.db`
- 手动确保 Hugging Face 仓库中存在这个文件

方案 B：

- 修改 Dockerfile
- 不再强依赖 `COPY timesheet.db`
- 让应用启动时自动创建空库

从长期维护角度看，方案 B 更稳妥。

### 7.6 Hugging Face 手动同步方案

说明文档：

- `docs/huggingface-manual-sync.md`

相关脚本：

- `整理HuggingFace同步包.bat`
- `scripts/prepare-hf-manual-sync.ps1`

同步原则：

- Git 是正式变更记录
- Hugging Face 只同步运行必须的文件
- 同步前先提交 Git

脚本当前会打包的内容：

- `.dockerignore`
- `Dockerfile`
- `README.md`
- `requirements.txt`
- `backend/`
- `frontend/`

不会打包：

- `.agents/`
- `.worktrees/`
- `.venv/`
- `.npm-cache/`
- `timesheet.db`
- 文档和本地临时文件

注意：

- 上述脚本和说明并不都在 Git 跟踪中
- 它们属于当前开发环境中存在的本地辅助工具

## 8. 测试相关

### 8.1 测试框架

当前测试主要使用：

- Python `unittest`

### 8.2 现有测试覆盖

`tests/test_project_schedule_feature.py`

- 项目进度 Excel 的三行块解析
- `upload-project-schedule` 接口
- `project-schedule-analysis` 接口
- milestone interval hours share 计算
- `Balsa3/Bamboo2` 的特殊映射逻辑

`tests/test_project_schedule_frontend.py`

- 项目进度监控前端结构
- API hook 是否存在
- 项目筛选器结构
- grid / legend / 高度配置
- 外部点击关闭逻辑
- 样式源码结构断言

`tests/test_frontend_style_density.py`

- 顶部导航与筛选器紧凑化
- 字体缩放
- Gantt 删除
- 旧模块移除
- granularity toggle 是否存在

### 8.3 当前缺失的测试

- 没有真正的浏览器级 E2E 测试
- 没有截图回归测试
- `/stats`、Reporting、Approval 的后端口径测试还不充分

### 8.4 测试数据准备方式

项目进度相关测试通过：

- 动态生成 `.xlsx`
- 使用临时 SQLite 数据库
- 直接 `seed_time_entries`

### 8.5 本地验证结果

最近一次本地已验证通过的命令：

```bash
python -m unittest tests.test_project_schedule_feature tests.test_project_schedule_frontend tests.test_frontend_style_density -v
```

结果：

- `21 tests OK`

前端构建验证：

```bash
npm run build
```

结果：

- 构建成功
- 仍有 Vite 大 chunk warning，但不是阻塞错误

## 9. 已知限制和技术债

- `frontend/src/App.jsx` 过大，前端结构接近“单文件应用”
- `timesheet.db` 不在 Git 中，但 Dockerfile 依赖它
- `setup_ip.py` 属于旧方案，会直接改源码，不适合当前正式流程
- 数据库迁移体系较弱，`migrate_db.py` 只是一次性的历史补丁
- `employees` 表基本未参与当前主流程
- 代码和部分文档里存在少量中文编码问题
- Hugging Face 同步目前仍偏手工，容易与 Git 漂移
- 前端构建体积较大
- 自动测试通过并不代表用户体验已经通过验收

## 10. 上下文记忆 / 文档 / 历史决策

### 10.1 当前仓库中可参考的文档

已确认存在并可参考的文档：

- `README.md`
- `docs/plans/2026-03-10-timesheet-design.md`
- `docs/plans/2026-03-10-implementation-plan.md`

当前本地环境中还存在但不一定在 Git 跟踪中的文档：

- `docs/huggingface-manual-sync.md`
- `docs/plans/2026-03-16-dashboard-granularity-toggle-design.md`
- `docs/plans/2026-03-16-dashboard-granularity-toggle-implementation.md`

### 10.2 重要历史决策

这些是接手时必须继承的关键业务/产品决策：

- 主看板总工时必须按 `Close` 口径
- `Balsa3/Bamboo2` 当前先按 `Balsa3`，将来若工时表出现 `Bamboo2` 再合并
- 项目进度监控使用独立上传入口
- 用户偏好按“月”查看工时
- 当前页面风格走轻产品化 SaaS 方向，而不是更朴素的 editorial 风格
- Gantt 页面已移除
- Git 与 Hugging Face 尽量保持一致
- 尽量不要向 `C:` 盘写新内容

### 10.3 TODO / FIXME 搜索结果

在当前仓库代码中没有发现：

- `TODO`
- `FIXME`
- `HACK`
- `XXX`

### 10.4 额外说明

曾在 IDE 上下文里出现过一个打开标签：

- `docs/plans/2026-03-15-font-density-implementation.md`

但当前仓库中未找到该文件。
因此它不能作为可依赖的正式文档来源。

## 11. 建议的实际交接方式

推荐使用以下方式移交给下一位 Claude / 开发者：

1. 先让对方阅读 `HANDOFF.md`
2. 再按本文最前面的“建议接手顺序”读取关键代码文件
3. 如果要继续开发“项目节点进度监控”，优先手动验证前端视觉问题
4. 确认无误后再进行 Git 提交和 Hugging Face 同步

如果需要给下一位 AI 一个简短的交接提示，可以直接附上这段话：

```md
请先阅读项目根目录下的 HANDOFF.md。

重点背景：
- 当前主线功能是“项目节点进度监控”的前端二次优化
- 后端和自动化测试已完成
- 用户最后一次反馈是图表仍有错位风险，因此 UI 视觉还未最终验收
- 主看板工时必须按 Close 口径
- Git 与 Hugging Face 要尽量同步
- 尽量不要向 C 盘写入新内容
```
