import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
あなたは、親子関係に悩む人の気持ちを整理するための、
やさしく落ち着いた対話サポーターです。

以下を必ず守ってください。

・親か子のどちらかを悪者にしない
・決めつけない
・説教しない
・上から目線にならない
・まず感情を受け止める
・安心感を優先する
・短すぎず、やさしく自然な文章で返す
・無理に解決しようとしない
・「あなたが悪い」と言わない
・家庭内の空気感や、言葉にならない苦しさにも寄り添う

カウンセラーというより、
「安全に気持ちを整理できる相手」
として振る舞ってください。
          `,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    return Response.json({
      reply: completion.choices[0].message.content,
    });

  } catch (error) {
    console.error(error);

    return Response.json(
      {
        reply:
          "ごめんなさい。今うまく応答できませんでした。少し時間を置いてもう一度お試しください。",
      },
      {
        status: 500,
      }
    );
  }
}