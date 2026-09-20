// demo.tsx —— dev-only 演示入口：?demo=birth / ?demo=race / ?demo=draw 直接用合成 model 渲染，
// 免多人流程即可目视验证 3D 场景（截图脚本使用）。
import { useMemo } from "react";
import { Recognize } from "../game/recognize";
import { synthParts } from "../game/synth";
import { BirthScreen } from "../screens/BirthScreen";
import { RaceScreen } from "../screens/RaceScreen";
import { DrawScreen } from "../screens/DrawScreen";
import type { HorseEntry } from "../state/game";

export function isDemoMode(): string | null {
  if (!import.meta.env.DEV) return null;
  const m = new URLSearchParams(location.search).get("demo");
  return m === "birth" || m === "race" || m === "draw" ? m : null;
}

export function DemoApp({ mode }: { mode: string }) {
  const horses: HorseEntry[] = useMemo(() => {
    const variants = [
      { name: "均衡腿", legLen: 150, ratio: 1.05 },
      { name: "大长腿", legLen: 195, ratio: 1.05 },
      { name: "小短腿", legLen: 105, ratio: 1.0 },
      { name: "比例失调", legLen: 185, ratio: 2.2 },
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
    return <BirthScreenDemo horses={horses} />;
  }
  return <RaceDemo horses={horses} />;
}

import { useEffect } from "react";
import { loadDemoRace, prepareBirth, useGame } from "../state/game";

function BirthScreenDemo({ horses }: { horses: HorseEntry[] }) {
  const g = useGame();
  useEffect(() => {
    // 借 state 层的暂存通道灌入 model（不发网络消息）
    const strokes = synthParts();
    prepareBirth(strokes, horses[0].model);
  }, [horses]);
  return g.myModel ? <BirthScreen demo /> : <div className="screen">加载中…</div>;
}

function RaceDemo({ horses }: { horses: HorseEntry[] }) {
  const g = useGame();
  useEffect(() => { loadDemoRace(horses); }, [horses]);
  return g.horses?.length ? <RaceScreen demo /> : <div className="screen">加载中…</div>;
}
