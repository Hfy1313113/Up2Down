@echo off
REM 无头浏览器截图验证：需要服务器已启动，输出到根目录 shots\
set ROOT=%~dp0..\..
if not exist "%ROOT%\shots" mkdir "%ROOT%\shots"
set EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
if not exist "%EDGE%" set EDGE=C:\Program Files\Microsoft\Edge\Application\msedge.exe
if not exist "%EDGE%" set EDGE=C:\Program Files\Google\Chrome\Application\chrome.exe
"%EDGE%" --headless=new --disable-gpu --window-size=1300,3150 --virtual-time-budget=4000 --screenshot="%ROOT%\shots\harness.png" http://localhost:8000/harness.html
"%EDGE%" --headless=new --disable-gpu --window-size=1280,800 --virtual-time-budget=4000 --screenshot="%ROOT%\shots\birth.png" http://localhost:8000/birth_test.html
echo 截图已输出到 shots\harness.png 与 shots\birth.png
pause
