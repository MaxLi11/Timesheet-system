@echo off
chcp 65001 > nul
title AnxShowtime 一键启动工具

echo ==================================================
echo         AnxShowtime 系统自动配置与启动
echo ==================================================
echo.

:: 1. 自动检测并配置局域网 IP
echo [1/3] 正在检测局域网 IP 并更新配置...
python setup_ip.py
if %ERRORLEVEL% NEQ 0 (
    echo [错误] IP 配置失败，请确保已安装 Python。
    pause
    exit /b
)
set /p LOCAL_IP=<current_ip.txt
echo [完成] 当前局域网访问地址: http://%LOCAL_IP%:3000
echo.

:: 2. 启动后端服务器
echo [2/3] 正在启动后端服务 (端口 8000)...
start "AnxShowtime 后端服务" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

:: 3. 启动前端界面
echo [3/3] 正在启动前端服务 (端口 3000)...
cd frontend
start "AnxShowtime 前端界面" cmd /k "npm run dev -- --host --port 3000"

echo.
echo ==================================================
echo    启动完成！请告知同事通过以下地址访问：
echo    http://%LOCAL_IP%:3000
echo ==================================================
echo.
echo *提示：请保持此窗口和新打开的两个黑色窗口不要关闭。*
pause
