# backend · 快速开始

```bash
# 启动（任选其一）
python server.py
# 或从仓库根目录
scripts\start.bat        # Windows
bash scripts/start.sh    # Linux/macOS
```

启动成功输出：

```
奔跑即故障服务器已启动:  http://localhost:8000
局域网内他人访问:      http://<你的局域网IP>:8000
```

## 配置

```bash
cp .env.example .env    # 然后编辑（可选）
```

支持的变量：`HOST` / `PORT` / `MAX_PLAYERS` / `DRAW_SECONDS`。
注意 server.py 读取的是**进程环境变量**：Linux/macOS 可 `export $(grep -v '^#' .env)`，
Windows 直接 `set PORT=9000 && python server.py`，或修改 `.env.example` 中的默认值。

## 测试

```bash
# 需服务器已启动；另开终端：
python -X utf8 test_e2e.py
```

预期结尾：`全部端到端测试通过 ✅`。测试覆盖：加入/房主分配、非房主开局被拒、
draw_phase 广播、done 提交与 race 广播一致性、again 重置、断线房主转移。

## 运维

| 场景 | 操作 |
|---|---|
| 局域网开玩 | 右键**以管理员身份**运行 `scripts/add_firewall_rule.bat`（一次性） |
| 异地联机 | 根目录放置 cloudflared.exe 后运行 `scripts/run_tunnel.bat`，分享公网链接 |
| 改人数/时长 | 环境变量 `MAX_PLAYERS` / `DRAW_SECONDS` 后重启 |
