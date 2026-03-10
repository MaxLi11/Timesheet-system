@echo off
chcp 65001 >nul
set PROJECT_ROOT=%~dp0
cd /d %PROJECT_ROOT%

echo ==================================================
echo 正在启动工时管理系统...
echo ==================================================

:: 1. 检查 Python 依赖
echo [1/3] 正在检查 Python 依赖...
.venv\Scripts\python -m pip install -r requirements.txt | findstr /V "already satisfied"

:: 2. 清理旧进程
echo [2/3] 正在清理残留进程...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do taskkill /f /pid %%a >nul 2>&1

:: 3. 启动并打开浏览器
echo [3/3] 正在启动服务...

:: 启动后端
start "Timesheet-Backend" cmd /c ".venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"

:: 启动前端
cd frontend
start "Timesheet-Frontend" cmd /c "npm run dev -- --host 127.0.0.1"

:: 等待服务就绪并打开浏览器
timeout /t 5 /nobreak >nul
start http://127.0.0.1:5173

echo.
echo ==================================================
echo 启动完成！
echo 如果浏览器没有自动打开，请手动访问: http://127.0.0.1:5173
echo ==================================================
echo.
pause
