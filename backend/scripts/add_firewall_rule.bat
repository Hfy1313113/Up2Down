@echo off
REM 为 8000 端口添加入站放行规则 —— 需要右键“以管理员身份运行”（只需执行一次）
netsh advfirewall firewall add rule name="HorseRaceGame" dir=in action=allow protocol=TCP localport=8000
echo.
echo 若提示“确定”，则防火墙规则已添加，局域网玩家即可访问。
pause
