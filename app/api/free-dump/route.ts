import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userDump, partnerDump } = body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,

      messages: [
        {
          role: "system",
          content: `
あなたはカップル・親子関係の感情翻訳AIです。

ユーザー同士のぶつかり合いの奥にある、
「本当は分かってほしい気持ち」
を丁寧に翻訳してください。

禁止：
- 心理診断
- 病名
- モラハラ等の断定
- 一方だけを悪者にすること

必ずJSONのみ返してください。
`,
        },
        {
          role: "user",
          content: `
【あなた】
${userDump}

【相手】
${partnerDump}

以下のJSON形式のみで返してください。

{
  "translatedUserFeelings": "",
  "translatedPartnerFeelings": "",
  "sessionTheme": "",
  "sessionGoal": "",
  "coreConflict": "",
  "nextStepHint": "",
  "bridgeMessage": ""
}
`,
        },
      ],
    });

    const raw =
      completion.choices?.[0]?.message?.content || "";

    console.log("RAW:", raw);

    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return Response.json(parsed);

  } catch (error) {
    console.error("FREE DUMP ERROR:", error);

    return Response.json({
      translatedUserFeelings:
        "うまく解析できませんでした。",
      translatedPartnerFeelings:
        "もう一度お試しください。",
      sessionTheme: "解析エラー",
      sessionGoal: "再試行",
      coreConflict: "データ取得エラー",
      nextStepHint:
        "時間を空けて再度試してください。",
      bridgeMessage:
        "会話を整理し直すと見えてくるものがあるかもしれません。",
    });
  }
}