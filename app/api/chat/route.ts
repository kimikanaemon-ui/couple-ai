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

    // セッション終了
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

- EMOTIONS: あなた(user)とパートナー(partner)を独立して0〜10で採点。
- KEYWORDS: 会話に頻出した感情・行動・テーマを3〜5語。
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

    // 通常会話
    const humanMessages = messages.filter((m: any) => m.role !== "assistant");
    const humanCount = humanMessages.length;

    if (humanCount <= 1) {
      return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
    }

    const lastSpeaker = humanMessages.slice(-1)[0]?.role;
    const defaultNext = lastSpeaker === "user" ? "partner" : "user";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `あなたはカップルカウンセリングの進行役AIです。
以下の会話を注意深く読み、カウンセラーとして介入してください。

【あなたの役割】
- 中立を保つ。どちらの味方もしない
- 会話の内容を必ず反映したコメントを作る
- 定型文・使い回しは絶対禁止
- 相手の言葉を引用・言い換えてコメントする

【介入タイプ】
- mediate  : 怒り・責め・強い対立がある → 感情を落ち着かせる
- clarify  : すれ違い・誤解・堂々巡りがある → 論点を整理する
- facilitate: 返答が短い・一方的・会話が止まっている → 引き出す
- encourage: 歩み寄り・理解・柔らかい言葉がある → 後押しする

【コメントの作り方（重要）】
- 会話の具体的な内容に必ず言及する
- 「〇〇について」「〇〇という気持ち」など具体的に
- 一文で短く。質問は一つだけ
- 30〜60文字

【nextSpeaker の判断基準】
- 二人の会話全体を読んで、今どちらに話しかけるのが最も効果的かを判断する
- 感情が強い方・まだ聞けていない方・誤解している方を優先
- 直前の発言者かどうかは関係ない。会話の流れで決める
- "user" または "partner" を返す

【出力】JSONのみ：
{"type":"mediate","comment":"〇〇という気持ちについて、もう少し聞かせてもらえますか？","nextSpeaker":"user"}`,
        },
        ...messages.map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: `[${m.role === "user" ? "あなた" : m.role === "partner" ? "パートナー" : "AI"}]: ${m.content}`,
        })),
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "{}";
    console.log("Couple AI判定:", raw);

    let interventionType = "facilitate";
    let comment = "";
    let nextSpeaker = defaultNext;

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
      comment = `「${lastMsg.slice(0, 15)}」について、もう少し詳しく聞かせてもらえますか？`;
    }

    return Response.json({
      shouldIntervene: true,
      interventionType,
      reply: comment,
      nextSpeaker,
    });

  } catch (error) {
    console.error(error);
    return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
  }
}