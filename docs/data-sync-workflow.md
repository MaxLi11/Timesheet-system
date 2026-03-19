# 数据同步工作流

## 概述

本文档说明如何将本地上传的工时和项目进度数据同步到 Hugging Face，让所有访问者都能看到最新数据。

## 工作流程

### 1. 本地上传数据

通过网页界面上传 Excel 文件：
- 工时表：通过"上传 Excel"按钮上传
- 项目进度表：通过"上传项目进度 Excel"按钮上传

数据会保存到本地的 `timesheet.db` 数据库文件中。

### 2. 提交数据库到 Git

每次上传新数据后，执行以下命令：

```bash
# 进入项目目录
cd /d/Antigravity/Project-timesheet

# 添加数据库文件
git add timesheet.db

# 提交更改（使用当前日期）
git commit -m "data: update timesheet data - $(date +%Y-%m-%d)"

# 推送到远程仓库
git push
```

### 3. 同步到 Hugging Face

**方法 A：自动同步（推荐）**
- 如果 HF Space 已配置 Git 同步，推送到 Git 后会自动同步

**方法 B：手动上传**
- 访问 Hugging Face Space 仓库
- 上传更新的 `timesheet.db` 文件
- 等待 Space 重新构建

## 验证

同步完成后：
1. 访问 HF 网站
2. 进入"项目工时分析"页面
3. 确认能看到项目进度数据
4. 检查数据是否为最新上传的内容

## 注意事项

- 数据库文件约 10MB，提交和同步需要一些时间
- 每次上传数据后都需要手动同步
- 建议在非高峰时段同步，避免影响用户访问
