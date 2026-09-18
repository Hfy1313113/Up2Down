// LobbyScreen.tsx —— 大厅：加入房间、玩家列表（房主标记）、房主开始按钮
import { useState } from "react";
import { useGame, join, startGame } from "../state/game";

export function LobbyScreen() {
  const g = useGame();
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [joining, setJoining] = useState(false);
  const joined = g.players.length > 0;
  const iAmHost = g.host != null && g.host === g.myId;

  const onJoin = async () => {
    setJoining(true);
    try {
      await join(name.trim() || `玩家${Math.floor(Math.random() * 99)}`, room.trim() || "default");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="screen lobby">
      <h1>🐎 奔跑即故障 · Up2Down</h1>
      <div className="meme-slogan">牛来马翻，边画边瘫！</div>
      <sub className="meme-sub"><del>不能只让作者一个人吃上这种细糠😭</del></sub>
      <div className="meme-tags">
        <span className="meme-tag">#发癫赛跑</span>
        <span className="meme-tag">#手搓赛博小马</span>
        <span className="meme-tag">#物理学不存在了</span>
        <span className="meme-tag">#粗糙也是一种态度</span>
      </div>
      {g.error && <p className="error">{g.error}</p>}

      {!joined ? (
        <div className="join-form">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="你的抽象代号（如：赛博牛来）" maxLength={12} />
          <input value={room} onChange={e => setRoom(e.target.value)} placeholder="神秘房间暗号（输入相同即联机）" maxLength={16} />
          <button onClick={onJoin} disabled={joining}>{joining ? "接入神经网…" : "进入对局大厅"}</button>
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
