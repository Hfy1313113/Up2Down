// Privacy.tsx —— 隐私政策：如实说明游戏会接触哪些数据、在哪里经过、保存多久。
import { Shell, PageCard, GITHUB_REPO } from "./Shell";

export function Privacy() {
  return (
    <Shell>
      <PageCard title="隐私政策" subtitle="最后更新：2026 年 10 月 3 日">
        <p>
          抽象 · Up2Down（下称「本游戏」）是一款无需注册、无账号体系的网页游戏。我们尽可能少地接触你的数据。本政策说明本游戏在运行时会处理哪些信息、如何处理，以及你的选择。
        </p>

        <h2>1. 我们不收集的内容</h2>
        <ul>
          <li>不要求注册账号，不收集邮箱、手机号、真实姓名或任何身份信息。</li>
          <li>不使用 Cookie 做追踪，不接入任何第三方统计、广告或分析 SDK。</li>
          <li>不在服务器保存你的画作、比赛结果或聊天内容（本游戏没有聊天功能）。</li>
        </ul>

        <h2>2. 对局期间临时处理的信息</h2>
        <ul>
          <li><b>昵称与房间号</b>：由你自行输入，仅用于在同一房间内标识玩家。它们存在于 Cloudflare Worker 的 Durable Object 内存中，房间空置后自动清除，不做持久化。</li>
          <li><b>画作与赛况</b>：你绘制的笔画、连点加速与出局状态通过 WebRTC DataChannel 直接发送给同房间的其他玩家，不经过我们的服务器。当点对点连接无法建立时，这些消息会经 Worker 原样转发给目标玩家，转发过程不记录、不保存。</li>
          <li><b>WebRTC 信令</b>：为了建立点对点连接，浏览器会交换 SDP 与 ICE 候选信息，其中包含你的网络地址。这是 WebRTC 的工作原理，同房间的其他玩家可能据此得知你的 IP 地址。请只与你信任的人共享房间号。</li>
        </ul>

        <h2>3. 保存在你浏览器本地的信息</h2>
        <p>以下偏好仅保存在你自己浏览器的 localStorage 中，不会上传：</p>
        <ul>
          <li>上次选择的风格包。</li>
          <li>音乐与音效的音量、静音开关。</li>
        </ul>
        <p>清除浏览器站点数据即可删除它们。</p>

        <h2>4. 托管与基础设施</h2>
        <p>
          本游戏托管于 Cloudflare Workers。Cloudflare 作为基础设施提供方可能按其自身政策记录访问日志（如 IP 地址、User-Agent、请求时间）用于安全与运维。相关内容以{" "}
          <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Cloudflare 隐私政策</a> 为准。
        </p>

        <h2>5. 儿童</h2>
        <p>本游戏不面向 13 周岁以下儿童设计，也不会有意收集其信息。由于本游戏不收集身份信息，我们无法识别用户年龄；未成年人请在监护人陪同下游玩。</p>

        <h2>6. 开源与可验证</h2>
        <p>
          本游戏全部源代码以 AGPL-3.0 协议公开于 <a href={GITHUB_REPO} target="_blank" rel="noreferrer">GitHub</a>，你可以自行审阅数据流向，或自行部署。
        </p>

        <h2>7. 政策变更与联系</h2>
        <p>
          本政策如有变更，会在本页更新日期并同步提交到仓库。任何疑问请通过 <a href={`${GITHUB_REPO}/issues`} target="_blank" rel="noreferrer">GitHub Issues</a> 联系我们。
        </p>
      </PageCard>
    </Shell>
  );
}
