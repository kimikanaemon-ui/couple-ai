import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const parseJson = (text: string, key: string): any => {
  const start = text.indexOf(`${key}:`);
  if (start === -1) return null;
  const rest = text.slice(start + key.length + 1).trim();
  const opener = rest[0];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0, end = -1;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === opener) depth++;
    else if (rest[i] === closer) { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  try { return JSON.parse(rest.slice(0, end + 1)); } catch { return null; }
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages || [];
    const isEndSession = body.isEndSession || false;
    const introData = body.introData || {};

    if (isEndSession) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `あなたは優しく冷静なカップルカウンセラーです。
ここまでの会話をカウンセリング視点で短くまとめてください。

まとめの末尾に必ず以下の形式でデータを付けてください（1行ずつ）：

EMOTIONS_JSON:{"user":{"anger":0,"sadness":0,"anxiety":0,"understanding":0},"partner":{"anger":0,"sadness":0,"anxiety":0,"understanding":0}}
KEYWORDS_JSON:["キーワード1","キーワード2","キーワード3"]
ISSUES_JSON:["争点1","争点2"]`,
          },
          ...messages.map((m: any) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content:
              m.role === "user"
                ? `【あなた】${m.content}`
                : m.role === "partner"
                ? `【パートナー】${m.content}`
                : `【AI】${m.content}`,
          })),
        ],
      });
      const raw = completion.choices?.[0]?.message?.content || "";
      const emotions = parseJson(raw, "EMOTIONS_JSON");
      const keywords = parseJson(raw, "KEYWORDS_JSON");
      const issues = parseJson(raw, "ISSUES_JSON");
      const reply = raw.replace(/EMOTIONS_JSON:[\s\S]+$/, "").trim();
      return Response.json({ reply, emotions, keywords, issues });
    }

    const humanMessages = messages.filter((m: any) => m.role !== "assistant");
    const assistantMessages = messages.filter((m: any) => m.role === "assistant");
    const humanCount = humanMessages.length;
    const assistantCount = assistantMessages.length;

    // 会話ステージ（3〜4発言ごとにAIが入る）
    const conversationStage =
      humanCount < 6 ? "listen" : humanCount < 12 ? "analyze" : "resolve";

    // listenステージ：3〜4発言に1回だけ介入
    if (conversationStage === "listen") {
      const lastAIIndex = messages.map((m: any) => m.role).lastIndexOf("assistant");
      const messagesSinceLastAI = lastAIIndex === -1 ? humanCount : messages.slice(lastAIIndex + 1).filter((m: any) => m.role !== "assistant").length;
      if (messagesSinceLastAI < 3) {
        return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
      }
    }

    if (humanCount < 2) {
      return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
    }

    const lastAIComment = assistantMessages.slice(-1)[0]?.content || "";
    const userCount = humanMessages.filter((m: any) => m.role === "user").length;
    const partnerCount = humanMessages.filter((m: any) => m.role === "partner").length;

    const stagePrompt: Record<string, string> = {
      listen: `【今のステージ：listen（3〜4発言に1回だけ介入）】
二人の会話を循環させることが最優先です。
橋渡しの質問を一つだけ：
- 「相手はその時どう受け取っていたと思いますか？」
- 「今の言葉、どう感じましたか？」
- 「その認識は合っていますか？」
会話のボールを相手側に渡してください。
分析・解釈は一切しないでください。`,

      analyze: `【今のステージ：analyze（核心の言語化）】
曖昧に優しくまとめるのではなく、
「何と何がぶつかっているのか」を短く具体的に言語化してください。

例：
- 「今ここで起きているのは、安心したい気持ちと、自由でいたい気持ちのぶつかりかもしれないですね」
- 「不安をどう扱うか、感覚ではなく言葉にしたい段階に来ている感じがします」
- 「○○さんは距離を縮めたくて、○○さんは自分のペースを守りたい。そのすれ違いが続いているのかもしれません」

心理テストのように、自分でも整理できる形で返してください。
「具体的な方法を探るために〜」のような曖昧なまとめ方は禁止です。`,

      resolve: `【今のステージ：resolve（次の一歩）】
核心が言語化された後のタイミングです。
二人が実際に動ける小さな一歩を一緒に考えてください。
「〜してみませんか」のような具体的な提案も可能です。`,
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `あなたは関係性を読むカップルカウンセラーです。

${introData.userName ? `【二人の基本情報】
あなた：${introData.userName}
パートナー：${introData.partnerName}
関係性：${introData.relationship}
現在困っていること：${introData.issue}
今日話したいテーマ：${introData.theme}
↑ この背景を踏まえて、会話のズレを自然に整理してください。

` : ""}${stagePrompt[conversationStage]}

【スタイル全般（厳守）】
- ユーザーが「分析された」ではなく「わかってもらえた」と感じる言葉を選ぶ
- 心理学用語・専門用語を使わない
- 1人へのカウンセリングではなく2人の会話循環を優先
- 必要以上の深掘り禁止
- 質問は最大1つ。時には質問しない
- 2〜3文以内
- 直前のAIコメントと同じ言い回し禁止：「${lastAIComment}」
- 「お互いの」「整理しましょう」などの定型句禁止
- 「整理」という言葉を使う場合は必ず具体的な内容を続ける
  例：「今は"安心したい"と"縛られたくない"がぶつかっています」
  禁止：整理だけ提案して終わる・「話し合いましょう」で終わる

【発言回数】あなた：${userCount}回 / パートナー：${partnerCount}回

【介入タイプ】
- facilitate: 会話を相手側に渡す橋渡し
- mediate  : 感情が激しい → 裏にある気持ちを一言で
- clarify  : すれ違いを自然に整理
- encourage: 歩み寄りをそっと後押し
- translate: 一方の気持ちをもう一方に届ける
- reflect  : 一方の言葉を別の角度で言い換える

【nextSpeaker の判断基準】
優先度1: AIが質問した → 答えていない人を続ける
優先度2: 「〜だから」「〜なんだ」と話し始めた → その人を続ける
優先度3: 3回以上連続 → 相手に切り替える
優先度4: それ以外 → 相手に切り替える
"user" または "partner" を返す

【出力】JSONのみ：
{"type":"facilitate","comment":"自然な橋渡しの一言","nextSpeaker":"partner"}`,
        },
        ...messages.map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content:
            m.role === "user"
              ? `【あなた】${m.content}`
              : m.role === "partner"
              ? `【パートナー】${m.content}`
              : `【AI】${m.content}`,
        })),
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "{}";
    console.log("Couple AI判定:", raw);

    let interventionType = "facilitate";
    let comment = "";
    let nextSpeaker = humanMessages.slice(-1)[0]?.role === "user" ? "partner" : "user";

    try {
      const parsed = JSON.parse(raw);
      interventionType = parsed.type || "facilitate";
      comment = parsed.comment?.trim() || "";
      if (parsed.nextSpeaker === "user" || parsed.nextSpeaker === "partner") {
        nextSpeaker = parsed.nextSpeaker;
      }
    } catch (e) { console.error(e); }

    if (!comment) {
      const lastMsg = humanMessages.slice(-1)[0]?.content || "";
      comment = `「${lastMsg.slice(0, 15)}」について、どんな気持ちがありますか？`;
    }

    // 「整理」を提案したなら必ず具体化する
    if (
      comment.includes("整理") &&
      !comment.includes("ぶつか") &&
      !comment.includes("ズレ") &&
      !comment.includes("違い") &&
      !comment.includes("差") &&
      !comment.includes("温度")
    ) {
      const recentContent = humanMessages.slice(-4).map((m: any) => m.content).join(" ");
      let addition = " 今は「求めている関係性の温度差」が強く出ている状態かもしれません。";
      if (recentContent.includes("不安")) {
        addition = " 今は「不安をどう扱うか」という、感覚ではなく言葉にしたい段階に来ている感じがあります。";
      } else if (recentContent.includes("連絡") || recentContent.includes("LINE")) {
        addition = " 問題は連絡頻度そのものではなく、「優先されている感覚のズレ」かもしれません。";
      } else if (recentContent.includes("安心") || recentContent.includes("縛")) {
        addition = " 今は「安心したい気持ち」と「縛られたくない気持ち」がぶつかっています。";
      }
      comment += addition;
    }

    return Response.json({ shouldIntervene: true, interventionType, reply: comment, nextSpeaker });

  } catch (error) {
    console.error(error);
    return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
  }
}