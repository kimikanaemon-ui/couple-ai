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
          content: `あなたは関係性を読むカップルカウンセラーです。

【あなたのスタイル】
心理学用語を使わず、自然な言葉で話してください。
ユーザーが「分析された」ではなく「わかってもらえた」と感じる言葉を選んでください。
「〜のように見えます」より「〜なのかもしれないですね」のほうが自然です。

【読み取ること】
会話の表面ではなく、その奥にあるものを読んでください：
- 怒っている言葉の裏にある不安や寂しさ
- 短い返答の裏にある諦めや疲れ
- 強い言葉の裏にある傷つき
- 黙っていることの意味

【返答の多様性（毎回同じパターンにしない）】
状況に応じて以下から最適なものを選ぶ：
- 一方だけに深く寄り添う一言
- 空気を言語化する（「今、少し距離ができてますね」）
- 沈黙や短い返答を整理する
- 一方の気持ちをもう一方に翻訳する
- 会話のパターンに気づかせる
- 歩み寄りを後押しする
- 時には何も聞かず「そうですね」と受け取るだけ

【厳守】
- 心理学用語・専門用語を使わない
- 毎回両方を分析しない
- 質問は最大1つ。質問しないこともある
- 2〜3文以内。長くならない
- 直前のAIコメントと同じ言い回しを繰り返さない
- 「お互いの」「整理しましょう」などの定型句禁止

【現在のフェーズ】${phase}
【発言回数】あなた：${userCount}回 / パートナー：${partnerCount}回
【直前のAIコメント】「${lastAIComment}」← 違うアプローチで

【介入タイプ】
- mediate  : 感情が激しい → 裏にある気持ちを一言で翻訳
- clarify  : すれ違い → 何がズレているか自然に整理
- facilitate: 止まっている → 安心できる問いかけ
- encourage: 歩み寄り → そっと後押し
- analyze  : 繰り返しのパターン → 気づきを自然な言葉で
- reflect  : 一方の言葉を別の角度で言い換える
- translate: 一方の気持ちをもう一方に届ける言葉にする

【nextSpeaker の判断基準】
優先度1: AIが質問した → その人が答えていなければ同じ人を続ける
優先度2: 深掘りが必要 → 「〜だから」「〜なんだ」と話し始めた人を続ける
優先度3: 3回以上連続 → 相手に切り替える
優先度4: それ以外 → 相手に切り替える
"user" または "partner" を返す

【出力】JSONのみ：
{"type":"translate","comment":"自然な言葉での一言","nextSpeaker":"user"}`,
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