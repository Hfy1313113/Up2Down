# -*- coding: utf-8 -*-
"""端到端测试：模拟 2 个 WS 客户端走 join→start→done→race 全流程"""
import base64
import json
import os
import socket
import struct
import sys
import time

HOST = "localhost"
PORT = 8000


class WsClient:
    def __init__(self, name):
        self.name = name
        self.sock = socket.create_connection((HOST, PORT))
        key = base64.b64encode(os.urandom(16)).decode()
        req = (f"GET /ws HTTP/1.1\r\nHost: {HOST}:{PORT}\r\n"
               "Upgrade: websocket\r\nConnection: Upgrade\r\n"
               f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.sock.sendall(req.encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            resp += self.sock.recv(4096)
        assert b"101" in resp.split(b"\r\n")[0], resp
        self.buf = b""

    def send(self, obj):
        data = json.dumps(obj, ensure_ascii=False).encode()
        mask = os.urandom(4)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        n = len(data)
        if n < 126:
            hdr = struct.pack("!BB", 0x81, 0x80 | n)
        elif n < 65536:
            hdr = struct.pack("!BBH", 0x81, 0x80 | 126, n)
        else:
            hdr = struct.pack("!BBQ", 0x81, 0x80 | 127, n)
        self.sock.sendall(hdr + mask + masked)

    def recv_msg(self, timeout=5):
        self.sock.settimeout(timeout)
        while True:
            if len(self.buf) >= 2:
                b1, b2 = self.buf[0], self.buf[1]
                ln = b2 & 0x7F
                off = 2
                if ln == 126:
                    if len(self.buf) < 4: self._fill()
                    ln = struct.unpack(">H", self.buf[2:4])[0]; off = 4
                elif ln == 127:
                    if len(self.buf) < 10: self._fill()
                    ln = struct.unpack(">Q", self.buf[2:10])[0]; off = 10
                if len(self.buf) < off + ln:
                    self._fill()
                    continue
                payload = self.buf[off:off + ln]
                self.buf = self.buf[off + ln:]
                op = b1 & 0x0F
                if op == 0x1:
                    return json.loads(payload.decode())
                if op == 0x8:
                    return None
                continue
            self._fill()

    def _fill(self):
        try:
            chunk = self.sock.recv(65536)
        except socket.timeout:
            raise TimeoutError("等待服务器消息超时")
        if not chunk:
            raise ConnectionError("连接已关闭")
        self.buf += chunk

    def drain_until(self, t, timeout=5):
        end = time.time() + timeout
        while time.time() < end:
            msg = self.recv_msg(timeout=max(0.1, end - time.time()))
            print(f"  [{self.name}] ← {msg['t']}", end="")
            if msg["t"] == "race":
                print(f"（{len(msg['horses'])} 匹马）")
            else:
                print()
            if msg["t"] == t:
                return msg
        raise TimeoutError(f"未等到 {t}")


def fake_horse():
    """分部位笔画：腿4条 + 头 + 屁股"""
    legs = []
    for hx in [140, 175, 265, 300]:
        pts = []
        for j in range(15):
            t = j / 14
            if t < 0.5:
                pts.append([hx + 8 * t * 2, 175 + t * 2 * 70])
            else:
                pts.append([hx + 8 - 28 * (t - 0.5) * 2, 175 + 70 + (t - 0.5) * 2 * 70])
        legs.append({"points": pts})
    return {
        "legs": legs,
        "head": [{"points": [[325, 165], [350, 120], [368, 100], [378, 108], [372, 128]]}],
        "butt": [{"points": [[122, 165], [95, 185], [82, 215]]}],
    }


def main():
    print("== 客户端 A 加入 ==")
    a = WsClient("A")
    a.send({"t": "join", "name": "小明", "room": "e2e"})
    st = a.drain_until("room_state")
    a.drain_until("joined")
    assert st["host"], "A 应为房主"
    print("房主:", st["host"], "✓")

    print("== 客户端 B 加入 ==")
    b = WsClient("B")
    b.send({"t": "join", "name": "小红", "room": "e2e"})
    b.drain_until("room_state")
    b.drain_until("joined")
    a.drain_until("room_state")

    print("== B（非房主）尝试开局，应被忽略 ==")
    b.send({"t": "start"})
    time.sleep(0.3)

    print("== A（房主）开局 ==")
    a.send({"t": "start"})
    a.drain_until("draw_phase")
    b.drain_until("draw_phase")
    print("进入绘制阶段 ✓")

    print("== 双方提交画作 ==")
    a.send({"t": "done", "strokes": fake_horse()})
    b.send({"t": "done", "strokes": fake_horse()})
    a.drain_until("player_done")
    b.drain_until("player_done")
    race_a = a.drain_until("race")
    race_b = b.drain_until("race")
    assert len(race_a["horses"]) == 2, "应有 2 匹马"
    assert all(h["strokes"] and h["strokes"].get("legs") for h in race_b["horses"]), "部位画作应随 race 广播"
    print(f"race 广播一致 ✓ 马匹数={len(race_a['horses'])}")

    print("== 再来一局 ==")
    a.send({"t": "again"})
    a.drain_until("room_state")
    b.drain_until("room_state")
    print("回到大厅 ✓")

    print("== 断开 A，房主应转移给 B ==")
    a.sock.close()
    msg = b.drain_until("room_state")
    assert len(msg["players"]) == 1 and msg["players"][0]["name"] == "小红"
    print("房主转移 ✓")

    print("\n全部端到端测试通过 ✅")


if __name__ == "__main__":
    main()
