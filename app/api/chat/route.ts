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
    const assistantMessages = messages.filter((m: any) => m.role === "assistant");
    const humanCount = humanMessages.length;
    const assistantCount = assistantMessages.length;

    // 会話ステージ
    const conversationStage =
      humanCount < 6 ? "listen" : humanCount < 12 ? "analyze" : "resolve";

    // listenステージかつAI介入済みなら待機（会話を循環させる）
    if (conversationStage === "listen" && assistantCount > 0) {
      return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
    }

    if (humanCount < 2) {
      return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
    }

    const lastAIComment = assistantMessages.slice(-1)[0]?.content || "";
    const userCount = humanMessages.filter((m: any) => m.role === "user").length;
    const partnerCount = humanMessages.filter((m: any) => m.role === "partner").length;

    const stagePrompt: Record<string, string> = {
      listen: `【今のステージ：listen】
二人の会話を循環させることが最優先です。
1人から長く情報収集しないでください。
橋渡しの質問を一つだけ使ってください：
- 「相手はその時どう受け取っていたと思いますか？」
- 「今の言葉、どう感じましたか？」
- 「その認識は合っていますか？」
会話のボールを相手側に渡してください。
分析・解釈は一切しないでください。`,

      analyze: `【今のステージ：analyze】
双方の認識差が見えてきた頃合いです。
会話の奥にあるものを自然な言葉で一言：
- 怒りの裏の不安や寂しさ
- 短い返答の裏の諦め
- 繰り返しのすれ違いパターン
「〜なのかもしれないですね」のような自然な表現を使ってください。
必要なら橋渡し質問も使ってください。`,

      resolve: `【今のステージ：resolve】
歩み寄りや気づきを後押しするタイミングです。
会話のパターンを穏やかに言語化し、
二人が次の一歩を踏み出せるよう背中を押してください。`,
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `あなたは関係性を読むカップルカウンセラーです。

${stagePrompt[conversationStage]}

【スタイル全般（厳守）】
- ユーザーが「分析された」ではなく「わかってもらえた」と感じる言葉を選ぶ
- 心理学用語・専門用語を使わない
- 1人へのカウンセリングではなく2人の会話循環を優先
- 必要以上の深掘り禁止
- 質問は最大1つ。時には質問しない
- 2〜3文以内
- 直前のAIコメントと同じ言い回し禁止：「${lastAIComment}」
- 「お互いの」「整理しましょう」などの定型句禁止

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

    return Response.json({ shouldIntervene: true, interventionType, reply: comment, nextSpeaker });

  } catch (error) {
    console.error(error);
    return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
  }
}