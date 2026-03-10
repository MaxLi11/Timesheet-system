@echo off
chcp 65001 >nul
set PROJECT_ROOT=%~dp0
cd /d %PROJECT_ROOT%
echo ==================================================
echo 正在启动工时管理系统...
echo 项目根目录: %PROJECT_ROOT%
echo ==================================================

:: 检查并安装 Python 依赖
echo [1/3] 正在检查 Python 环境依赖...
.venv\Scripts\python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [错误] Python 依赖安装失败，请检查网络或联系开发人员。
    pause
    exit /b
)

:: 尝试清理旧进程（如果端口被占用）
echo 正在清理旧的端口占用 (8000/5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do taskkill /f /pid %%a >nul 2>&1

:: 启动后端服务
echo [2/3] 正在启动后端服务 (FastAPI)...
start "Timesheet-Backend" cmd /c ".venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

:: 启动前端服务
echo [3/3] 正在启动前端服务 (Vite)...
cd frontend
:: 如果 node_modules 不存在则安装依赖
if not exist node_modules (
    echo 正在安装前端依赖，请稍候...
    call npm install
)
start "Timesheet-Frontend" cmd /c "npm run dev"

:: 等待几秒钟确保服务启动
echo 正在尝试为您打开浏览器...
timeout /t 5 /nobreak >nul

:: 自动打开浏览器
start http://localhost:5173

echo.
echo ==================================================
echo 启动成功！
echo.
echo 后端地址: http://localhost:8000
echo 前端地址: http://localhost:5173 (已尝试自动打开)
echo.
echo 注意：请保持窗口不要关闭。
echo ==================================================
echo.
pause
