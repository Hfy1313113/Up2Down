// LobbyScreen.tsx —— 大厅：加入房间（四位数字房间号）、玩家列表（房主标记）、房主开始按钮
import { useState, useRef } from "react";
import { useGame, join, startGame } from "../state/game";

function randomFourDigits(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function LobbyScreen() {
  const g = useGame();
  const [name, setName] = useState("");
  const [room, setRoom] = useState(() => randomFourDigits());
  const [joining, setJoining] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const joined = g.players.length > 0;
  const iAmHost = g.host != null && g.host === g.myId;

  const digits = [room[0] || "", room[1] || "", room[2] || "", room[3] || ""];

  const handleDigitChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    const nextRoom = newDigits.join("");
    setRoom(nextRoom);
    if (char && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    setRoom(pasted);
    const targetIdx = Math.min(pasted.length - 1, 3);
    inputRefs.current[targetIdx]?.focus();
  };

  const onJoin = async () => {
    if (room.length !== 4) return;
    setJoining(true);
    try {
      await join(name.trim() || `骑手${Math.floor(Math.random() * 99)}`, room);
    } finally {
      setJoining(false);
    }
  };

  const rollNewRoom = () => {
    const fresh = randomFourDigits();
    setRoom(fresh);
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="screen lobby">
      <h1>🐎 奔跑即故障 · Up2Down</h1>
      <div className="meme-slogan">牛来马翻，边画边瘫！</div>
      <sub className="meme-sub"><del>不能只让作者一个人吃上这种细糠😭</del></sub>

      {g.error && <p className="error">{g.error}</p>}

      {!joined ? (
        <div className="join-form">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="你的代号（选填，默认随机）"
            maxLength={12}
          />

          <div className="digit-group">
            <div className="digit-header">
              <span>四位数字房间号</span>
              <button type="button" className="digit-dice-btn" onClick={rollNewRoom}>
                🎲 随机换号
              </button>
            </div>
            <div className="digit-inputs">
              {[0, 1, 2, 3].map(i => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digits[i]}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  className="digit-box"
                />
              ))}
            </div>
          </div>

          <button onClick={onJoin} disabled={joining || room.length !== 4}>
            {joining ? "接入神经网…" : "进入房间"}
          </button>
        </div>
      ) : (
        <div className="lobby-wait">
          <p>当前房间 <b>{g.room}</b> · 集合进度 <b>{g.players.length}/4</b> 人</p>
          <ul className="players">
            {g.players.map(p => (
              <li key={p.id} className={p.id === g.host ? "host" : ""}>
                {p.name}{p.id === g.myId ? "（你）" : ""}{p.id === g.host ? " 👑 发车司机" : ""}
              </li>
            ))}
          </ul>
          <p className="hint">{iAmHost ? "👑 你是发车司机，全员就绪后即可发车！" : "☕ 正在等待房主发车，深呼吸放平心态…"}</p>
          <p className="links">
            神经直连：P2P × {g.links.p2p}
            {g.links.relay > 0 ? ` · 兜底中转 × ${g.links.relay}` : ""}
          </p>
          {iAmHost && <button className="primary" onClick={startGame}>全员起跑发车 🚀</button>}
        </div>
      )}
    </div>
  );
}
