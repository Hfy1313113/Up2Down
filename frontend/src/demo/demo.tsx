// demo.tsx —— dev-only 演示入口：?demo=birth / ?demo=race / ?demo=draw 直接用合成 model 渲染，
// 免多人流程即可目视验证 3D 场景（截图脚本使用）。可加 &style=<风格包 id> 指定风格，&me=<0~3> 指定自己是第几位玩家。
import { useEffect, useMemo } from "react";
import { Recognize } from "../game/recognize";
import { synthParts } from "../game/synth";
import { BirthScreen } from "../screens/BirthScreen";
import { RaceScreen } from "../screens/RaceScreen";
import { DrawScreen } from "../screens/DrawScreen";
import type { ElephantEntry } from "../state/game";
import { loadDemoRace, prepareBirth, setStyle, useGame } from "../state/game";
import { hasPack } from "../style/registry";

export function isDemoMode(): string | null {
  if (!import.meta.env.DEV) return null;
  const m = new URLSearchParams(location.search).get("demo");
  return m === "birth" || m === "race" || m === "draw" ? m : null;
}

export function DemoApp({ mode }: { mode: string }) {
  useEffect(() => {
    const st = new URLSearchParams(location.search).get("style");
    if (st && hasPack(st)) setStyle(st);
  }, []);

  const elephants: ElephantEntry[] = useMemo(() => {
    const variants = [
      { name: "抽象派", legLen: 150, ratio: 1.05 },
      { name: "印象派大长腿", legLen: 195, ratio: 1.05 },
      { name: "具象派小短腿", legLen: 105, ratio: 1.0 },
      { name: "盲人摸象", legLen: 185, ratio: 2.2 },
    ];
    return variants.map((v, i) => ({
      id: `demo${i}`,
      name: v.name,
      model: Recognize.analyzeParts(synthParts({ legLen: v.legLen, ratio: v.ratio })),
    }));
  }, []);

  if (mode === "draw") {
    return <DrawScreen />;
  }
  if (mode === "birth") {
    return <BirthScreenDemo elephants={elephants} />;
  }
  return <RaceDemo elephants={elephants} />;
}

function BirthScreenDemo({ elephants }: { elephants: ElephantEntry[] }) {
  const g = useGame();
  useEffect(() => {
    const strokes = synthParts();
    prepareBirth(strokes, elephants[0].model);
  }, [elephants]);
  return g.myModel ? <BirthScreen demo /> : <div className="screen">加载中…</div>;
}

function RaceDemo({ elephants }: { elephants: ElephantEntry[] }) {
  const g = useGame();
  useEffect(() => {
    const me = Number(new URLSearchParams(location.search).get("me") ?? 0);
    loadDemoRace(elephants, Number.isFinite(me) ? me : 0);
  }, [elephants]);
  return g.elephants?.length ? <RaceScreen demo /> : <div className="screen">加载中…</div>;
}
