// App.tsx —— 阶段机：大厅 → 绘制 → 等待 → 赛跑
import { useEffect } from "react";
import { useGame, wireTransport } from "./state/game";
import { LobbyScreen } from "./screens/LobbyScreen";
import { DrawScreen } from "./screens/DrawScreen";
import { WaitingScreen } from "./screens/WaitingScreen";
import { RaceScreen } from "./screens/RaceScreen";

export default function App() {
  const g = useGame();
  useEffect(() => { wireTransport(); }, []);

  switch (g.phase) {
    case "draw":
      return <DrawScreen />;
    case "waiting":
      return <WaitingScreen doneNames={g.doneNames} total={g.players.length} />;
    case "race":
      return <RaceScreen />;
    default:
      return <LobbyScreen />;
  }
}
