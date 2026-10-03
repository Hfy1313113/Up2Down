// About.tsx —— 关于我们：作品介绍、署名、技术栈、许可证与联系方式。
import { Shell, PageCard, AUTHORS, GITHUB_REPO } from "./Shell";

export function About() {
  return (
    <Shell>
      <PageCard title="关于我们" subtitle="抽象 · Up2Down 是一款开源、非盈利的多人在线抽象画象赛跑派对网页游戏。">
        <h2>这是什么</h2>
        <p>
          没有预设角色模型，每一头大象都来自玩家亲手绘制。腿部、头部、臀部三段接力作画，识别成「髋关节 + 膝关节」双关节连杆大象，
          腿长与比例直接决定步幅与步频。叫上好友输入同一个房间号，看谁画出跑得最快（或最抽象）的冠军象。
        </p>
        <p>口号：<b>牛来象翻，边画边瘫</b>。横批：<b>抽象</b>。</p>

        <h2>作者署名</h2>
        <ul>
          {AUTHORS.map(a => (
            <li key={a.name}>
              <b>{a.role}</b>：GitHub 开发者 <a href={a.url} target="_blank" rel="noreferrer">{a.name}</a>
            </li>
          ))}
        </ul>
        <p>版权所有 © 2026 Up2Down Authors & Contributors。</p>

        <h2>开源许可</h2>
        <p>
          本项目代码依据 <a href={`${GITHUB_REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">GNU Affero General Public License v3.0（AGPL-3.0）</a> 开放源代码。
          你可以使用、学习、分发或提供网络托管服务，但任何修改、衍生开发或网络服务提供均必须以相同的 AGPL-3.0 协议公开源代码，并完整保留原始版权声明与归属标识。
        </p>

        <h2>技术栈</h2>
        <ul>
          <li>前端：React 19 + TypeScript + Vite + Tailwind CSS；Three.js 驱动 3D 大象、赛道与相机。</li>
          <li>联机：WebRTC DataChannel 网状直连传画作与赛况；Cloudflare Worker + Durable Objects 提供房间信令与兜底中转。</li>
          <li>风格系统：大象/驭象师材质、赛道装饰、展台、界面配色、音乐与音效由「风格包」声明，机制与内容解耦。</li>
          <li>音频：音效与回落曲目由 WebAudio 程序化合成；风格包可附带正规渠道获得的音频文件，播完一遍自动渐出、再起渐入循环。
            「宝莱坞狂欢」的鞭响取自 <a href="https://commons.wikimedia.org/wiki/File:Whip-sound.ogg" target="_blank" rel="noreferrer">Whip Sound</a>（Mike Koenig，<a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>），象鸣取自 Wikimedia Commons CC0 录音《Elephant voice - trumpeting.ogg》（Info-farmer）。</li>
        </ul>

        <h2>文化致敬</h2>
        <p>
          内置风格包「宝莱坞狂欢」以彩绘大象、曼陀罗与佩斯利纹样、托拉纳门、神庙剪影与万寿菊彩带致敬印度节庆艺术；
          「腋毛攻击」致敬「驾考宝典」路怒症科普动画与《黑街 (DJ Remix)》的空耳梗——夜色高速、橙色路灯、方块车与握着方向盘的卷发司机，
          全部形象均由程序化几何与 Canvas 纹理原创重绘，不含原作画面素材。
          我们以尊重与欣赏的态度呈现这些元素，欢迎提出改进建议。
        </p>

        <h2>联系我们</h2>
        <p>
          问题反馈、功能建议与贡献，请前往 <a href={`${GITHUB_REPO}/issues`} target="_blank" rel="noreferrer">GitHub Issues</a>。
        </p>
      </PageCard>
    </Shell>
  );
}
