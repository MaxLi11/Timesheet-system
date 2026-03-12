@echo off
chcp 65001 > nul
title AnxShowtime 迁移打包工具

echo ==================================================
echo         AnxShowtime 迁移包准备中...
echo ==================================================
echo.

set TARGET_DIR=AnxShowtime_Migration_Package

:: 1. 清理旧的打包目录
if exist %TARGET_DIR% rd /s /q %TARGET_DIR%
mkdir %TARGET_DIR%

:: 2. 编译前端
echo [1/4] 正在编译前端代码 (npm run build)...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 前端编译失败。
    pause
    exit /b
)
cd ..

:: 3. 复制文件
echo [2/4] 正在收集必要文件...
mkdir %TARGET_DIR%\backend
xcopy backend %TARGET_DIR%\backend /E /I /Y
copy requirements.txt %TARGET_DIR%\
copy docker-compose.yml %TARGET_DIR%\
copy Dockerfile.backend %TARGET_DIR%\
copy Dockerfile.frontend %TARGET_DIR%\
copy timesheet.db %TARGET_DIR%\

:: 复制前端构建产物
mkdir %TARGET_DIR%\frontend_dist
xcopy frontend\dist %TARGET_DIR%\frontend_dist /E /I /Y

:: 4. 生成 IT 部署说明
echo [3/4] 正在生成 IT 部署说明文档...
(
echo # AnxShowtime 部署说明 ^(供公司 IT 参考^)
echo.
echo ## 1. 环境扩展
echo 本系统采用 Docker 容器化设计，推荐在 Linux 或 Windows Server ^(安装有 Docker^) 上运行。
echo.
echo ## 2. 部署方式 ^(Docker^)
echo 在当前目录下运行以下命令即可启动全量服务：
echo ```bash
echo docker-compose up -d
echo ```
echo - 后端 API 端口：8000
echo - 前端 端口：3000
echo.
echo ## 3. 手动部署 ^(非 Docker^)
echo - **后端**: 运行 `pip install -r requirements.txt` 后，启动 `uvicorn backend.main:app --host 0.0.0.0`。
echo - **前端**: 托管 `frontend_dist` 目录下的静态文件到 Nginx 或 IIS。
echo.
echo ## 4. 数据库
echo 系统使用 SQLite 数据库，数据存储在 `timesheet.db` 文件中，请确保该文件具有读写权限。
) > %TARGET_DIR%\部署说明_IT必读.md

echo.
echo [4/4] 打包完成！
echo ==================================================
echo 请将文件夹 "%TARGET_DIR%" 拷贝到公司服务器即可。
echo ==================================================
echo.
pause
