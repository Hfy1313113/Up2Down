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
      <h1>奔跑即故障</h1>
      <p className="subtitle">分部位手绘你的小马，腿决定速度！</p>
      {g.error && <p className="error">{g.error}</p>}

      {!joined ? (
        <div className="join-form">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="你的名字" maxLength={12} />
          <input value={room} onChange={e => setRoom(e.target.value)} placeholder="房间号" maxLength={16} />
          <button onClick={onJoin} disabled={joining}>{joining ? "加入中…" : "加入房间"}</button>
        </div>
      ) : (
        <div className="lobby-wait">
          <p>房间 <b>{g.room}</b> · {g.players.length}/4 人</p>
          <ul className="players">
            {g.players.map(p => (
              <li key={p.id} className={p.id === g.host ? "host" : ""}>
                {p.name}{p.id === g.myId ? "（你）" : ""}{p.id === g.host ? " 👑" : ""}
              </li>
            ))}
          </ul>
          <p className="hint">{iAmHost ? "你是房主，就绪后即可开始比赛" : "等待房主开始比赛…"}</p>
          {iAmHost && <button onClick={startGame}>开始比赛</button>}
        </div>
      )}
    </div>
  );
}
