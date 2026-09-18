// WaitingScreen.tsx —— 已提交，等待其他玩家（诞生仪式占位：Step3 接 Birth 组件）
export function WaitingScreen({ doneNames, total }: { doneNames: string[]; total: number }) {
  return (
    <div className="screen waiting">
      <h2>🐴 你的小马已提交！</h2>
      <p>诞生仪式将在 Step3 登场，现在先确认画作收到了～</p>
      <p>已提交：{doneNames.length ? doneNames.join("、") : "（等待房主统计）"} / {total} 人</p>
    </div>
  );
}
