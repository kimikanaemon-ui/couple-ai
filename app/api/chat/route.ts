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
    const humanCount = humanMessages.length;

    // 介入条件
    const shouldIntervene =
      humanCount >= 2 ||
      (messages.slice(-1)[0]?.content?.length ?? 0) > 25;

    if (!shouldIntervene) {
      return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
    }

    const lastAIComment = messages.filter((m: any) => m.role === "assistant").slice(-1)[0]?.content || "";
    const phase = humanCount <= 4 ? "序盤" : humanCount <= 8 ? "中盤" : "終盤";
    const userCount = humanMessages.filter((m: any) => m.role === "user").length;
    const partnerCount = humanMessages.filter((m: any) => m.role === "partner").length;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `あなたは関係性分析を行うカップルカウンセラーAIです。
あなたの役割は、単なる司会進行ではなく、以下を読み取ることです：
- 感情・防衛反応・すれ違い・回避・不安・支配・愛情欲求・傷つき

「この会話で本当は何が起きているか」を言語化してください。
必要に応じて：
- 怒りの裏の不安
- 冷たさの裏の諦め
- 強い言葉の裏の傷つき
- 防御反応・会話パターン
を穏やかに分析してください。

ただし、人格障害などを断定してはいけません。
「〜のように見えます」「〜の可能性があります」という形で表現してください。

ユーザーは「正論」よりも"理解された感覚"を求めています。
綺麗事ではなく、会話内容に踏み込んだ分析をしてください。

【現在のフェーズ】${phase}
【発言回数】あなた：${userCount}回 / パートナー：${partnerCount}回
【直前のAIコメント】「${lastAIComment}」← 同じ内容・表現を繰り返さない

【介入タイプ】
- mediate  : 怒り・責め・強い対立 → 感情の裏にあるものを分析
- clarify  : すれ違い・誤解・堂々巡り → 会話パターンを言語化
- facilitate: 返答が短い・回避的 → 安心して話せる問いかけ
- encourage: 歩み寄りの言葉 → その変化を肯定し深める
- analyze  : 深い感情・防衛反応が見える → 関係性パターンを分析
- reflect  : 相手の言葉を別角度から言い換えて返す
- pattern  : 繰り返しのすれ違いが見える → パターンを指摘
- translate: 一方の言葉を他方に翻訳して伝える

【返答スタイル】
- 必要なら2〜4文で返答してよい
- 表面的な質問だけで終わらせない
- 「何が起きているか」の分析を含める
- 自然な話し言葉で、穏やかに

【nextSpeaker の判断基準（最重要）】
以下の優先順位で判断する：

優先度1【AIの質問に未回答】
- 直前のAIコメントが質問形式で、その質問に答えていない場合
- → 答えていない人を nextSpeaker にする

優先度2【深掘りが必要】
- 新しい視点・重要な感情・具体的なエピソードを出した直後
- 「〜だから」「〜なんだよ」など理由や背景を話し始めた場合
- → その人への深掘りを続ける

優先度3【発言バランス】
- 片方が3回以上連続して話している場合のみ相手に切り替える

優先度4【相手への切り替え】
- 上記3つに該当しない場合のみ相手に切り替える

"user" または "partner" を返す

【出力】JSONのみ・説明不要：
{"type":"analyze","comment":"分析を含んだ具体的なコメント","nextSpeaker":"user"}`,
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

    return Response.json({ shouldIntervene: true, interventionType, reply: comment, nextSpeaker });

  } catch (error) {
    console.error(error);
    return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
  }
}