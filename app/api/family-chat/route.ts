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
            content: `あなたは優しく冷静な家族カウンセラーです。
ここまでの親子の会話をカウンセリング視点で短くまとめてください。

まとめの末尾に必ず以下の形式でデータを付けてください（1行ずつ）：

EMOTIONS_JSON:{"parent":{"anger":0,"sadness":0,"anxiety":0,"understanding":0},"child":{"anger":0,"sadness":0,"anxiety":0,"understanding":0}}
KEYWORDS_JSON:["キーワード1","キーワード2","キーワード3"]
ISSUES_JSON:["争点1","争点2"]

- EMOTIONS: 保護者(parent)とお子さん(child)を独立して0〜10で採点。
- KEYWORDS: 会話に頻出した感情・行動・テーマを3〜5語。
- ISSUES: 親子間で対立・すれ違いが起きていた核心的な争点を1〜3つ。`,
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `あなたは親子の対話を支援するカウンセラーAIです。
会話を読んで介入タイプをJSONで返してください。

【ルール】
- 会話が2往復以上あれば必ず none 以外を返す
- none は会話が1往復以下の時だけ

【タイプ選択基準】
- mediate  : 怒り・非難・責め・強い感情が1つでもある
- clarify  : 同じ内容が繰り返されている・話がかみ合っていない
- facilitate: 返答が短い（10文字以下）・一言だけ・会話が止まっている
- encourage: ありがとう・ごめん・わかった・歩み寄りの言葉がある
- none     : 会話が1往復以下のみ

【出力形式】JSONのみ。余計な文字は一切不要。
{"type":"facilitate","comment":"今どんな気持ちか、もう少し聞かせてもらえますか？"}

【コメント作成ルール】
- 必ず日本語で一文
- 親子関係に配慮した優しい言葉
- 質問は一つだけ
- 20文字〜50文字程度`,
        },
        ...messages.map((m: any) => ({
          role: "user",
          content: `[${m.role}]: ${m.content}`,
        })),
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || '{"type":"none","comment":""}';
    console.log("Family AI判定:", raw);

    let interventionType = "none";
    let comment = "";
    try {
      const parsed = JSON.parse(raw);
      interventionType = parsed.type || "none";
      comment = parsed.comment?.trim() || "";
    } catch (e) { console.error(e); }

    const shouldIntervene = interventionType !== "none" && comment.length > 0;
    const humanCount = messages.filter((m: any) => m.role !== "assistant").length;

    // フォールバック：2メッセージ以上あるのに介入なしなら強制介入
    if (!shouldIntervene && humanCount >= 2) {
      return Response.json({
        shouldIntervene: true,
        interventionType: "facilitate",
        reply: "お二人とも、今感じていることを少し話してみませんか？",
      });
    }

    return Response.json({ shouldIntervene, interventionType, reply: shouldIntervene ? comment : null });

  } catch (error) {
    console.error(error);
    return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
  }
}