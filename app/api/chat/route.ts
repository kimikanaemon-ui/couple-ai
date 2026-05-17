import OpenAI from "openai";

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY,
});

const parseJson = (text: string, key: string): any => {
const start = text.indexOf(`${key}:`);
if (start === -1) return null;

const rest = text.slice(start + key.length + 1).trim();
const opener = rest[0];
const closer = opener === "{" ? "}" : "]";

let depth = 0;
let end = -1;

for (let i = 0; i < rest.length; i++) {
if (rest[i] === opener) depth++;
else if (rest[i] === closer) {
depth--;
if (depth === 0) {
end = i;
break;
}
}
}

if (end === -1) return null;

try {
return JSON.parse(rest.slice(0, end + 1));
} catch {
return null;
}
};

export async function POST(req: Request) {
try {
const body = await req.json();

```
const messages = body.messages || [];
const isEndSession = body.isEndSession || false;

// =========================
// セッション終了
// =========================

if (isEndSession) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
```

あなたは優しく冷静なカップルカウンセラーです。

ここまでの会話を短くまとめてください。

重要：

* 綺麗にまとめすぎない
* 実際にぶつかっていたテーマを自然に言語化
* 「何がズレていたのか」を中心に整理

最後に必ず以下を付けてください：

EMOTIONS_JSON:{"user":{"anger":0,"sadness":0,"anxiety":0,"understanding":0},"partner":{"anger":0,"sadness":0,"anxiety":0,"understanding":0}}

KEYWORDS_JSON:["キーワード1","キーワード2"]

ISSUES_JSON:["争点1","争点2"]
`,
},

```
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

  const raw =
    completion.choices?.[0]?.message?.content || "";

  const emotions = parseJson(raw, "EMOTIONS_JSON");
  const keywords = parseJson(raw, "KEYWORDS_JSON");
  const issues = parseJson(raw, "ISSUES_JSON");

  const reply = raw.replace(
    /EMOTIONS_JSON:[\s\S]+$/,
    ""
  ).trim();

  return Response.json({
    reply,
    emotions,
    keywords,
    issues,
  });
}

// =========================
// 通常会話
// =========================

const humanMessages = messages.filter(
  (m: any) => m.role !== "assistant"
);

const assistantMessages = messages.filter(
  (m: any) => m.role === "assistant"
);

const humanCount = humanMessages.length;

if (humanCount < 2) {
  return Response.json({
    shouldIntervene: false,
    interventionType: "none",
    reply: null,
  });
}

// =========================
// 会話ステージ
// =========================

const conversationStage =
  humanCount < 8
    ? "listen"
    : humanCount < 18
    ? "analyze"
    : "resolve";

// =========================
// AI介入頻度
// listen中は3〜4往復放置
// =========================

const lastAIIndex = messages
  .map((m: any) => m.role)
  .lastIndexOf("assistant");

const humanSinceLastAI =
  lastAIIndex === -1
    ? humanCount
    : messages
        .slice(lastAIIndex + 1)
        .filter((m: any) => m.role !== "assistant")
        .length;

if (
  conversationStage === "listen" &&
  humanSinceLastAI < 4
) {
  return Response.json({
    shouldIntervene: false,
    interventionType: "none",
    reply: null,
  });
}

const lastAIComment =
  assistantMessages.slice(-1)[0]?.content || "";

const userCount = humanMessages.filter(
  (m: any) => m.role === "user"
).length;

const partnerCount = humanMessages.filter(
  (m: any) => m.role === "partner"
).length;

// =========================
// ステージ別Prompt
// =========================

const stagePrompt: Record<string, string> = {
  listen: `
```

【listenステージ】

今は分析しない。

最優先は、
二人の会話を循環させること。

AIは主役にならない。

やること：

* 認識の確認
* 相手への橋渡し
* 一言だけ整理
* 短く言い換える

だけで十分。

良い例：

* 「パートナーさんは、
  “責められている”
  感覚になっていましたか？」

* 「今は、
  “安心したい側”と
  “自由でいたい側”
  がぶつかっていそうですね」

* 「予定共有の感覚が
  かなり違っていそうですね」

禁止：

* 深掘り質問
* 長い分析
* 綺麗なまとめ
* 「詳しく教えてください」
* 「どうしてそう感じたのですか？」

1〜2文で終える。
`,

```
  analyze: `
```

【analyzeステージ】

今は、
二人のズレを
自然に言語化してよい。

ただし：

* 心理学用語禁止
* AIっぽい分析禁止
* 断定禁止

例：

* 「安心を求めるほど、
  相手は縛られる感覚になっているのかもしれないですね」

* 「未来を急ぎたい気持ちと、
  慎重になりたい気持ちが
  ズレている感じがありますね」

* 「“誠意”の定義が
  かなり違っていそうです」

長く喋らない。
`,

```
  resolve: `
```

【resolveステージ】

今は、
小さな歩み寄りを作る段階。

ただし説教禁止。

* 現実的
* 小さい
* 実行可能

を重視。

例：

* 「まずは予定共有だけ
  ルール化してみますか？」

* 「LINE量ではなく、
  返信タイミングを決める方法もありそうですね」
  `,
  };

  const completion =
  await openai.chat.completions.create({
  model: "gpt-4o-mini",

  ```
    messages: [
      {
        role: "system",

        content: `
  ```

あなたは、
会話のズレを可視化する
カップルカウンセラーAIです。

${stagePrompt[conversationStage]}

【最重要】

1人を深掘りするAIではない。

目的は：

「二人の認識のズレを
自然に見えるようにすること」

AIは：

* 橋渡し役
* 整理役
* 翻訳役

として振る舞う。

【禁止】

* 毎回分析する
* 毎回まとめる
* AIが喋りすぎる
* カウンセラーっぽい綺麗事

禁止例：

* 「お互いを理解することが大切ですね」
* 「不安があるのかもしれませんね」
* 「詳しく教えてください」

【スタイル】

* 短く
* 自然に
* 人間っぽく
* 1〜2文
* 時には一言だけ

【発言回数】

あなた：${userCount}回
パートナー：${partnerCount}回

【直前のAIコメント】

「${lastAIComment}」

↑
これと違う切り口にすること。

【介入タイプ】

* facilitate
* clarify
* reflect
* translate
* mediate
* encourage

【nextSpeaker】

* AIが質問した相手を優先
* 深掘り中の人を優先
* 3回以上連続なら切り替え

"user"
または
"partner"

【出力】

JSONのみ：

{
"type":"clarify",
"comment":"自然な短い一言",
"nextSpeaker":"partner"
}
`,
},

```
      ...messages.map((m: any) => ({
        role:
          m.role === "assistant"
            ? "assistant"
            : "user",

        content:
          m.role === "user"
            ? `【あなた】${m.content}`
            : m.role === "partner"
            ? `【パートナー】${m.content}`
            : `【AI】${m.content}`,
      })),
    ],

    response_format: {
      type: "json_object",
    },
  });

const raw =
  completion.choices?.[0]?.message?.content?.trim() ||
  "{}";

console.log("Couple AI:", raw);

let interventionType = "facilitate";
let comment = "";

let nextSpeaker =
  humanMessages.slice(-1)[0]?.role === "user"
    ? "partner"
    : "user";

try {
  const parsed = JSON.parse(raw);

  interventionType =
    parsed.type || "facilitate";

  comment = parsed.comment?.trim() || "";

  if (
    parsed.nextSpeaker === "user" ||
    parsed.nextSpeaker === "partner"
  ) {
    nextSpeaker = parsed.nextSpeaker;
  }
} catch (e) {
  console.error(e);
}

return Response.json({
  shouldIntervene: true,
  interventionType,
  reply: comment,
  nextSpeaker,
});
```

} catch (error) {
console.error(error);

```
return Response.json({
  shouldIntervene: false,
  interventionType: "none",
  reply: null,
});
```

}
}
