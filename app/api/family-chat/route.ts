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
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `あなたは優しく冷静な家族カウンセラーです。
ここまでの親子の会話をカウンセリング視点で短くまとめてください。

まとめの末尾に必ず以下の形式でデータを付けてください（1行ずつ）：

EMOTIONS_JSON:{"parent":{"anger":0,"sadness":0,"anxiety":0,"understanding":0},"child":{"anger":0,"sadness":0,"anxiety":0,"understanding":0}}
KEYWORDS_JSON:["キーワード1","キーワード2","キーワード3"]
ISSUES_JSON:["争点1","争点2"]`,
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

    const humanMessages = messages.filter((m: any) => m.role !== "assistant");
    const humanCount = humanMessages.length;

    if (humanCount <= 1) {
      return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
    }

    const lastSpeaker = humanMessages.slice(-1)[0]?.role;
    const defaultNext = lastSpeaker === "parent" ? "child" : "parent";

    // 直前のAIコメントを取得（繰り返し防止）
    const lastAIComment = messages.filter((m: any) => m.role === "assistant").slice(-1)[0]?.content || "";

    // 会話フェーズ判定
    const phase = humanCount <= 4 ? "序盤" : humanCount <= 8 ? "中盤" : "終盤";

    // 発言回数集計
    const parentCount = humanMessages.filter((m: any) => m.role === "parent").length;
    const childCount = humanMessages.filter((m: any) => m.role === "child").length;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `あなたは親子カウンセリングの進行役AIです。
以下の会話を注意深く読み、カウンセラーとして介入してください。

【現在のフェーズ】${phase}
【発言回数】保護者：${parentCount}回 / お子さん：${childCount}回
【直前のAIコメント】「${lastAIComment}」← これと同じ内容・表現を絶対に繰り返さない

【絶対に守るルール】
- 直前のAIコメントと異なるアプローチで介入する
- 「お互いの意見を」「もう少し詳しく」などの汎用表現禁止
- 会話に出た具体的な言葉（スマホ・ゲーム・ルール等）を必ず使う

【フェーズ別アプローチ】
- 序盤: それぞれの状況・背景を引き出す質問
- 中盤: 感情の根本・本当に伝えたいことを掘り下げる
- 終盤: 歩み寄りや具体的な解決策を促す

【介入タイプ】
- mediate  : 怒り・責め・強い対立 → 感情を言語化させる
- clarify  : すれ違い・誤解・堂々巡り → 何が本質的な問題か整理
- facilitate: 返答が短い・止まっている → 安心して話せる質問
- encourage: 歩み寄りの言葉がある → その気持ちをさらに深める

【コメント作成】
- 会話の具体的な内容を必ず反映する
- 30〜60文字・質問は一つだけ・自然な話し言葉

【nextSpeaker の判断基準（最重要）】
以下の優先順位で判断する：

優先度1【AIの質問に未回答】
- 直前のAIコメントが質問形式で、その質問に答えていない場合
- → 答えていない人を nextSpeaker にする（絶対に切り替えない）

優先度2【深掘りが必要】
- 新しい視点・重要な感情・具体的なエピソードを出した直後
- 「〜だから」「〜なんだよ」など理由や背景を話し始めた場合
- → その人への深掘りを続ける（相手に切り替えない）

優先度3【発言バランス】
- 片方が3回以上連続して話している場合のみ相手に切り替える
- 単純な交互切り替えはしない

優先度4【相手への切り替え】
- 上記3つに該当しない場合のみ相手に切り替える

"parent" または "child" を返す

【出力】JSONのみ・説明不要：
{"type":"facilitate","comment":"会話内容を反映した具体的なコメント","nextSpeaker":"child"}`,
        },
        ...messages.map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: `[${m.role === "parent" ? "保護者" : m.role === "child" ? "お子さん" : "AI"}]: ${m.content}`,
        })),
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "{}";
    console.log("Family AI判定:", raw);

    let interventionType = "facilitate";
    let comment = "";
    let nextSpeaker = defaultNext;

    try {
      const parsed = JSON.parse(raw);
      interventionType = parsed.type || "facilitate";
      comment = parsed.comment?.trim() || "";
      if (parsed.nextSpeaker === "parent" || parsed.nextSpeaker === "child") {
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