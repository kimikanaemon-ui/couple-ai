import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userDump, partnerDump } = body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `あなたはカップルの気持ちを翻訳するカウンセラーです。
二人それぞれの「ぶちまけ」を読んで、以下をJSONで返してください。

【ルール】
- 感情の裏にあるものを自然な言葉で丁寧に翻訳する（2〜4文）
- 心理学用語・専門用語を使わない
- 「〜なのかもしれません」「〜と感じているのかも」のような柔らかい表現
- 一方を責めず、どちらの気持ちも丁寧に扱う
- 禁止ラベル：モラハラ・毒親・依存・自己愛・発達障害
- nextStepHint は「これから二人で話せばきっと変わっていけそうな方向性」を温かく具体的に示す（2〜3文）

【出力形式】JSONのみ：
{
  "translatedUserFeelings": "あなたの気持ちの翻訳（2〜4文、丁寧に）",
  "translatedPartnerFeelings": "パートナーの気持ちの翻訳（2〜4文、丁寧に）",
  "sessionTheme": "二人の間で起きていることを一言で（20文字以内）",
  "sessionGoal": "今日の対話で目指せそうなこと（30文字以内）",
  "coreConflict": "何と何がぶつかっているか（例：安心したい vs 自由でいたい）",
  "nextStepHint": "これから解決できそうな方向性（2〜3文、希望を感じる言葉で）"
}`,
        },
        {
          role: "user",
          content: `【あなたのぶちまけ】\n${userDump}\n\n【パートナーのぶちまけ】\n${partnerDump}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const result = JSON.parse(raw);
    return Response.json(result);

  } catch (error) {
    console.error(error);
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}