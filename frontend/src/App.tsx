// App.tsx —— 阶段机：大厅 → 绘制 → 等待 → 赛跑
import { useEffect } from "react";
import { useGame, wireTransport } from "./state/game";
import { DemoApp, isDemoMode } from "./demo/demo";
import { LobbyScreen } from "./screens/LobbyScreen";
import { DrawScreen } from "./screens/DrawScreen";
import { BirthScreen } from "./screens/BirthScreen";
import { WaitingScreen } from "./screens/WaitingScreen";
import { RaceScreen } from "./screens/RaceScreen";

export default function App() {
  const g = useGame();
  const demo = isDemoMode();
  useEffect(() => { if (!demo) wireTransport(); }, [demo]);
  if (demo) return <DemoApp mode={demo} />;

  if (g.phase === "race") {
    return <RaceScreen />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 overflow-x-hidden">
      <main className="w-full flex flex-col items-center justify-center my-auto">
        {(() => {
          switch (g.phase) {
            case "draw":
              return <DrawScreen />;
            case "birth":
              return <BirthScreen />;
            case "waiting":
              return <WaitingScreen />;
            default:
              return <LobbyScreen />;
          }
        })()}
      </main>
    </div>
  );
}
