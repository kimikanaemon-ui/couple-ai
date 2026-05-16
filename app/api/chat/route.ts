import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ① 判定機能：介入タイプを定義
type InterventionType =
  | "none"        // 介入しない
  | "mediate"     // 仲裁（感情激化・対立）
  | "facilitate"  // 促進（会話を引き出す）
  | "clarify"     // 整理（堂々巡り・誤解）
  | "encourage";  // 後押し（建設的な流れ）

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

    // セッション終了時
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
ISSUES_JSON:["争点1","争点2"]

【定義】
- EMOTIONS: anger/sadness/anxiety/understanding を0〜10で採点。userとpartnerを独立して評価。
- KEYWORDS: 会話に頻出した感情・行動・テーマを3〜5語で抽出。
- ISSUES: 二人の間で対立・すれ違いが起きていた核心的な争点を1〜3つ。`,
          },
          ...messages.map((m: any) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: `[${m.role}]: ${m.content}`,
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

    // ① 通常会話：介入判定（JSON形式で確実にパース）
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `あなたはカップルの対話の進行役・仲裁役AIです。
以下の会話を読み、介入すべきか判断してください。

【介入条件】
- 怒り・非難・責める言葉がある → mediate
- 同じ話題が繰り返されている・すれ違い → clarify  
- 片方だけ話している・返答が短い → facilitate
- 歩み寄りの言葉がある → encourage
- 会話が1往復以下 → none

【出力】必ずJSON1行だけ返す：
{"type":"none","comment":""}
または
{"type":"mediate","comment":"一言の仲裁コメント"}

typeはnone/mediate/facilitate/clarify/encourageのどれか。
noneの場合commentは空文字。
JSONのみ出力。説明不要。`,
        },
        ...messages.map((m: any) => ({
          role: "user",
          content: `[${m.role}]: ${m.content}`,
        })),
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || '{"type":"none","comment":""}';
    console.log("AI判定raw:", raw);

    // ② JSON パース
    let interventionType: InterventionType = "none";
    let comment = "";
    try {
      const parsed = JSON.parse(raw);
      interventionType = (parsed.type as InterventionType) || "none";
      comment = parsed.comment?.trim() || "";
    } catch (e) {
      console.error("パース失敗:", e);
    }

    const shouldIntervene = interventionType !== "none" && comment.length > 0;

    // フォールバック：4メッセージ以上あるのに介入なしなら強制介入
    const humanMessageCount = messages.filter((m: any) => m.role !== "assistant").length;
    if (!shouldIntervene && humanMessageCount >= 4) {
      return Response.json({
        shouldIntervene: true,
        interventionType: "facilitate",
        reply: "少し整理しましょうか。今一番伝えたいことは何ですか？",
      });
    }

    return Response.json({
      shouldIntervene,
      interventionType,
      reply: shouldIntervene ? comment : null,
    });

  } catch (error) {
    console.error(error);
    return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
  }
}