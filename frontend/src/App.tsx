// App.tsx —— 路由 + 阶段机：/ 首页、/about、/privacy、/terms 为带统一标题栏与页脚的静态页；
// /play 进入游戏（大厅 → 绘制 → 具象化 → 等待 → 赛跑）。风格包在此落地为 UI 主题与音效表，
// 非赛跑阶段的背景音乐也在此按阶段切换（赛跑阶段由 RaceScreen 掌控）。
import { useEffect } from "react";
import { useGame, wireTransport } from "./state/game";
import { DemoApp, isDemoMode } from "./demo/demo";
import { LobbyScreen } from "./screens/LobbyScreen";
import { DrawScreen } from "./screens/DrawScreen";
import { BirthScreen } from "./screens/BirthScreen";
import { WaitingScreen } from "./screens/WaitingScreen";
import { RaceScreen } from "./screens/RaceScreen";
import { useRoute } from "./router";
import { Landing } from "./pages/Landing";
import { About } from "./pages/About";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { getPack } from "./style/registry";
import { applyUiTheme } from "./style/theme";
import { setSfxPack } from "./audio/sfx";
import { music } from "./audio/music";

export default function App() {
  const g = useGame();
  const route = useRoute();
  const demo = isDemoMode();
  const pack = getPack(g.styleId);

  useEffect(() => { applyUiTheme(pack); setSfxPack(pack); }, [pack]);
  useEffect(() => { if (!demo) wireTransport(); }, [demo]);

  // 非赛跑阶段背景音乐：大厅/绘制/等待 → menu；具象化 → birth（缺省回落 menu）；离开 /play 停止
  useEffect(() => {
    if (demo) return;
    if (route !== "play") { music.stop(); return; }
    if (g.phase === "race") return;
    const useBirth = g.phase === "birth" && !!pack.music.birth;
    const track = useBirth ? pack.music.birth : pack.music.menu;
    if (track) void music.play(track, `${pack.id}:${useBirth ? "birth" : "menu"}`);
    else music.stop();
  }, [demo, route, g.phase, pack]);

  if (demo) return <DemoApp mode={demo} />;

  if (route === "landing") return <Landing />;
  if (route === "about") return <About />;
  if (route === "privacy") return <Privacy />;
  if (route === "terms") return <Terms />;

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
