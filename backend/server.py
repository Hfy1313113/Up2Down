# -*- coding: utf-8 -*-
"""画马赛跑 联机服务器 —— 纯标准库：HTTP 静态文件 + WebSocket 房间中继（RFC6455）"""
import base64
import hashlib
import json
import os
import struct
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "frontend"))

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))
MAX_PLAYERS = int(os.environ.get("MAX_PLAYERS", "4"))
# 3 个部位 × 50s + 诞生仪式与缓冲
DRAW_SECONDS = int(os.environ.get("DRAW_SECONDS", "200"))
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

rooms = {}
rooms_lock = threading.Lock()


class Player:
    def __init__(self, pid, name, ws):
        self.id = pid
        self.name = name
        self.ws = ws          # WsConn
        self.done = False
        self.strokes = None


class WsConn:
    """对一条已升级 WebSocket 连接的帧读写封装（服务端不掩码）。"""

    def __init__(self, sock, rfile):
        self.sock = sock
        self.rfile = rfile
        self.send_lock = threading.Lock()
        self.alive = True

    def send_text(self, text):
        data = text.encode("utf-8")
        n = len(data)
        if n < 126:
            hdr = struct.pack("!BB", 0x81, n)
        elif n < 65536:
            hdr = struct.pack("!BBH", 0x81, 126, n)
        else:
            hdr = struct.pack("!BBQ", 0x81, 127, n)
        with self.send_lock:
            try:
                self.sock.sendall(hdr + data)
            except OSError:
                self.alive = False

    def read_message(self):
        """返回 (opcode, payload_bytes)；连接关闭返回 (None, None)。"""
        payload = b""
        while True:
            hdr = self.rfile.read(2)
            if len(hdr) < 2:
                return None, None
            b1, b2 = hdr[0], hdr[1]
            fin = b1 & 0x80
            op = b1 & 0x0F
            ln = b2 & 0x7F
            if ln == 126:
                ext = self.rfile.read(2)
                if len(ext) < 2:
                    return None, None
                ln = struct.unpack(">H", ext)[0]
            elif ln == 127:
                ext = self.rfile.read(8)
                if len(ext) < 8:
                    return None, None
                ln = struct.unpack(">Q", ext)[0]
            mask = self.rfile.read(4) if (b2 & 0x80) else None
            data = self.rfile.read(ln) if ln else b""
            if len(data) < ln:
                return None, None
            if mask:
                data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
            if op == 0x9:            # ping -> pong
                self._send_frame(0xA, data)
                continue
            if op == 0x8:            # close
                return None, None
            if op in (0x1, 0x2, 0x0):
                payload += data
                if fin:
                    return op, payload
            # 其它 opcode 忽略

    def _send_frame(self, op, data):
        with self.send_lock:
            try:
                self.sock.sendall(struct.pack("!BB", 0x80 | op, len(data)) + data)
            except OSError:
                self.alive = False

    def close(self):
        self.alive = False
        try:
            self.sock.close()
        except OSError:
            pass


class Room:
    def __init__(self, code):
        self.code = code
        self.players = {}          # pid -> Player
        self.host_id = None
        self.phase = "lobby"       # lobby / drawing / racing
        self.deadline = 0.0
        self.timer = None
        self.lock = threading.Lock()

    def broadcast(self, msg, exclude=None):
        text = json.dumps(msg, ensure_ascii=False)
        for p in list(self.players.values()):
            if p.id != exclude:
                p.ws.send_text(text)

    def state_msg(self):
        return {
            "t": "room_state",
            "room": self.code,
            "phase": self.phase,
            "host": self.host_id,
            "players": [
                {"id": p.id, "name": p.name, "done": p.done}
                for p in self.players.values()
            ],
        }

    def join(self, player):
        with self.lock:
            if self.phase != "lobby":
                player.ws.send_text(json.dumps(
                    {"t": "error", "msg": "比赛进行中，请稍后再加入"}))
                return False
            if len(self.players) >= MAX_PLAYERS:
                player.ws.send_text(json.dumps(
                    {"t": "error", "msg": "房间已满（最多 4 人）"}))
                return False
            self.players[player.id] = player
            if self.host_id is None:
                self.host_id = player.id
        self.broadcast(self.state_msg())
        return True

    def leave(self, pid):
        with self.lock:
            p = self.players.pop(pid, None)
            if p is None:
                return
            if self.host_id == pid:
                self.host_id = next(iter(self.players), None)
            empty = not self.players
            if empty:
                if self.timer:
                    self.timer.cancel()
        if empty:
            with rooms_lock:
                rooms.pop(self.code, None)
        else:
            self.broadcast(self.state_msg())

    def start(self, pid):
        with self.lock:
            if pid != self.host_id or self.phase != "lobby":
                return
            self.phase = "drawing"
            for p in self.players.values():
                p.done = False
                p.strokes = None
            self.deadline = time.time() + DRAW_SECONDS
            self.timer = threading.Timer(DRAW_SECONDS, self.deadline_reached)
            self.timer.daemon = True
            self.timer.start()
        self.broadcast({"t": "draw_phase", "seconds": DRAW_SECONDS})

    def submit(self, pid, strokes):
        with self.lock:
            p = self.players.get(pid)
            if p is None or self.phase != "drawing":
                return
            p.done = True
            p.strokes = strokes
            all_done = all(q.done for q in self.players.values())
            name = p.name
        self.broadcast({"t": "player_done", "id": pid, "name": name})
        if all_done and self.timer:
            self.timer.cancel()
            self.begin_race()

    def deadline_reached(self):
        with self.lock:
            if self.phase != "drawing":
                return
        self.begin_race()

    def begin_race(self):
        with self.lock:
            self.phase = "racing"
            horses = [
                {"id": p.id, "name": p.name, "strokes": p.strokes or []}
                for p in self.players.values()
            ]
        self.broadcast({"t": "race", "horses": horses})

    def again(self, pid):
        with self.lock:
            if self.phase != "racing":
                return
            self.phase = "lobby"
            for p in self.players.values():
                p.done = False
                p.strokes = None
        self.broadcast(self.state_msg())


def get_room(code):
    with rooms_lock:
        r = rooms.get(code)
        if r is None:
            r = rooms[code] = Room(code)
        return r


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=STATIC_DIR, **kw)

    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        if self.headers.get("Upgrade", "").lower() == "websocket":
            self.handle_websocket()
            return
        super().do_GET()

    def handle_websocket(self):
        key = self.headers.get("Sec-WebSocket-Key")
        if not key:
            self.send_error(400)
            return
        accept = base64.b64encode(
            hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.end_headers()
        self.wfile.flush()

        ws = WsConn(self.request, self.rfile)
        player = None
        room = None
        try:
            while True:
                op, data = ws.read_message()
                if op is None:
                    break
                if op != 0x1:
                    continue
                try:
                    msg = json.loads(data.decode("utf-8"))
                except (ValueError, UnicodeDecodeError):
                    continue
                t = msg.get("t")
                if t == "join":
                    player = Player(uuid.uuid4().hex[:8], str(msg.get("name", "玩家"))[:16], ws)
                    room = get_room(str(msg.get("room", "default"))[:24] or "default")
                    if room.join(player):
                        ws.send_text(json.dumps({
                            "t": "joined", "id": player.id, "room": room.code}))
                    else:
                        break
                elif player is None or room is None:
                    continue
                elif t == "start":
                    room.start(player.id)
                elif t == "done":
                    room.submit(player.id, msg.get("strokes") or [])
                elif t == "again":
                    room.again(player.id)
        finally:
            if room is not None and player is not None:
                room.leave(player.id)


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"画马赛跑服务器已启动:  http://localhost:{PORT}")
    print(f"局域网内他人访问:      http://<你的局域网IP>:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
