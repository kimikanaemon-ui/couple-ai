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
    const introData = body.introData || {};
    const preConflict = body.preConflict || "";
    const preGoal = body.preGoal || "";

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
              m.role === "user" ? `【あなた】${m.content}`
              : m.role === "partner" ? `【パートナー】${m.content}`
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

    // listenステージ：3〜4発言に1回だけ介入
    if (conversationStage === "listen") {
      const lastAIIndex = messages.map((m: any) => m.role).lastIndexOf("assistant");
      const messagesSinceLastAI = lastAIIndex === -1
        ? humanCount
        : messages.slice(lastAIIndex + 1).filter((m: any) => m.role !== "assistant").length;
      if (messagesSinceLastAI < 3) {
        return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
      }
    }

    if (humanCount < 2) {
      return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
    }

    const lastAIComment = assistantMessages.slice(-1)[0]?.content || "";
    const userCount = humanMessages.filter((m: any) => m.role === "user").length;
    const partnerCount = humanMessages.filter((m: any) => m.role === "partner").length;

    // 連続発言チェック
    const lastSpeaker = humanMessages.slice(-1)[0]?.role;
    let consecutiveCount = 0;
    for (let i = humanMessages.length - 1; i >= 0; i--) {
      if (humanMessages[i].role === lastSpeaker) consecutiveCount++;
      else break;
    }
    const forceSwitch = consecutiveCount >= 3;

    // モラハラ・支配的言動を検知
    const recentText = humanMessages.slice(-6).map((m: any) => m.content).join(" ");
    const moralHarassKeywords = ["お前","うるさい","黙れ","馬鹿","死ね","消えろ","お前のせい","全部お前が","何やっても","どうせお前","役に立たない","価値ない","おかしい","狂ってる","嘘つき","被害妄想"];
    const suppressedKeywords = ["私が悪い","私のせい","ごめんなさい","怒らせてしまった","私がおかしい","仕方ない","我慢","言えない","怖い","怒られる"];
    const hasMoralHarass = moralHarassKeywords.some(w => recentText.includes(w));
    const hasSupressed = suppressedKeywords.some(w => recentText.includes(w));

    // 5ターンごとに要約フラグ
    const shouldSummarize = humanCount > 0 && humanCount % 5 === 0;

    const CORE_PRINCIPLES = `
【役割】

あなたは

- カップルカウンセラー
- 家族療法ファシリテーター
- 感情翻訳者
- 対話仲裁者

を兼ねたAIです。

【最優先】

利用者が

「理解された」

と感じること。

会話を急いで解決しない。

まず理解する。

---

【分析レベル】

毎回可能な範囲で

1. 感情
2. ニーズ
3. 価値観
4. 思考パターン

を読む。

---

【思考パターン】

以下の傾向が見えたら自然に触れる。

- 白黒思考
- 決めつけ
- 過度な一般化
- 先読み不安
- 自己否定
- 他責化

診断は禁止。

断定は禁止。

---

【感情翻訳】

怒りだけで終わらない。

怒りの奥にある

- 不安
- 孤独
- 悲しみ
- 恐れ
- 期待

を言語化する。

---

【統計情報】

会話内容に応じて

一般的な統計

研究結果

社会データ

を補足として出してよい。

形式

【参考データ】
〜〜〜

説教に使わない。

---

【質問】

毎回質問しない。

質問頻度30％以下。

---

【要約】

5ターンごとに

【ここまでの整理】

・起きたこと
・感情
・願い
・まだ埋まらない部分

を自然にまとめる。

---

【文章量】

2〜6文程度。

必要ならもう少し長くてもよい。

---
`;

    const stagePrompt: Record<string, string> = {
    listen: `
【listenステージ】

まだ結論を出さない。

感情を整理する。

相手の言葉を要約する。

必要なら

- 怒りの裏側
- 不安
- 寂しさ

を言語化する。

質問は必要時のみ。
`,

      analyze: `
【analyzeステージ】

今起きている対立を言語化する。

さらに

- お互いの願い
- 価値観の違い
- 認識のズレ
- 思考パターン

を分析する。

表面的なまとめは禁止。

深く読む。
`,

      resolve: `
【resolveステージ】

解決策を押し付けない。

まず

「何が分かったか」

を確認する。

その後で

現実的な一歩を提案する。
`,

    // モラハラ・抑圧検知時の特別プロンプト
    const specialNote = hasMoralHarass ? `
【重要：支配的・攻撃的な発言が検出されました】
このような言動をする人の心理的背景を穏やかに探ってください：
- なぜそのような言い方になるのか（不安・恐れ・コントロール欲求）
- 「〜のような言い方になるとき、どんな気持ちが先にありますか？」
- 断定せず「〜のように聞こえることがありますが、どうでしょうか？」
- 相手を傷つけていることへの気づきを促す
禁止ラベル：モラハラ・DV・支配と直接断定しない。` : hasSupressed ? `
【重要：自己抑圧・萎縮した発言が検出されました】
この人に対して以下を伝えてください：
- 自分の気持ちを話すことは正当な権利であること
- 虐げられているわけではなく、もう少し心を開いてよいこと
- 「あなたが感じていることは、とても大切なことです」
- 「自分を責めすぎず、今感じていることをそのまま話してみてください」
背中を押す応援の言葉を使ってください。` : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `あなたは関係性を読むカップルカウンセラーです。

${introData.userName ? `【二人の基本情報】
あなた：${introData.userName}
パートナー：${introData.partnerName}
関係性：${introData.relationship}
現在困っていること：${introData.issue}
今日話したいテーマ：${introData.theme}
` : ""}${preConflict ? `【事前翻訳結果】
核心的なぶつかり：${preConflict}
今日の目標：${preGoal}
` : ""}${stagePrompt[conversationStage]}
${specialNote}
${CORE_PRINCIPLES}
【中立性ルール（厳守）】
- 一方を「加害者」「被害者」と決めつけない
- 「モラハラ」「DV」「依存」などの強いラベルをAI側から断定しない
- 禁止ラベルが出た場合は「そう受け取られている状況」に置き換える

【スタイル全般（厳守）】
- ユーザーが「分析された」ではなく「わかってもらえた」と感じる言葉
- 心理学用語・専門用語を使わない
- 1人へのカウンセリングではなく2人の会話循環を優先
- 質問は最大1つ。時には質問しない
- 2〜3文以内
- 直前のAIコメントと同じ言い回し禁止：「${lastAIComment}」
- 「お互いの」「整理しましょう」などの定型句禁止
- 「整理」という言葉を使う場合は必ず具体的な内容を続ける

【発言回数】あなた：${userCount}回 / パートナー：${partnerCount}回
${forceSwitch ? "【重要】同じ人が3回以上連続で話しているので、必ず相手に切り替えること" : ""}

【nextSpeaker の判断基準】
優先度1: AIが質問した → 答えていない人を続ける
優先度2: 「〜だから」「〜なんだ」と話し始めた → その人を続ける
優先度3: 3回以上連続 → 相手に切り替える
優先度4: それ以外 → 相手に切り替える
"user" または "partner" を返す

【介入タイプ】
- facilitate: 会話を相手側に渡す橋渡し
- mediate  : 感情が激しい → 裏にある気持ちを一言で
- clarify  : すれ違いを自然に整理
- encourage: 歩み寄りをそっと後押し
- translate: 一方の気持ちをもう一方に届ける
- reflect  : 一方の言葉を別の角度で言い換える
- support  : 自己抑圧している人を応援・背中を押す
- explore  : 攻撃的発言の背景にある心理を穏やかに探る

【出力】JSONのみ：
{"type":"facilitate","comment":"自然な橋渡しの一言","nextSpeaker":"partner"}`,
        },
        ...messages.map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content:
            m.role === "user" ? `【あなた】${m.content}`
            : m.role === "partner" ? `【パートナー】${m.content}`
            : `【AI】${m.content}`,
        })),
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "{}";
    console.log("Couple AI判定:", raw);

    let interventionType = "facilitate";
    let comment = "";
    let nextSpeaker = lastSpeaker === "user" ? "partner" : "user";

    try {
      const parsed = JSON.parse(raw);
      interventionType = parsed.type || "facilitate";
      comment = parsed.comment?.trim() || "";
      if (parsed.nextSpeaker === "user" || parsed.nextSpeaker === "partner") {
        nextSpeaker = parsed.nextSpeaker;
      }
    } catch (e) { console.error(e); }

    if (forceSwitch) nextSpeaker = lastSpeaker === "user" ? "partner" : "user";

    // 禁止ラベルを中立表現に置き換える
    const bannedLabels = ["モラハラ", "毒親", "依存", "自己愛", "発達障害", "パワハラ", "ガスライティング", "DV"];
    for (const word of bannedLabels) {
      if (comment.includes(word)) {
        comment = comment.replace(word, "そう受け取られている状況");
      }
    }

    // 「整理」を提案したなら必ず具体化する
    if (
      comment.includes("整理") &&
      !comment.includes("ぶつか") &&
      !comment.includes("ズレ") &&
      !comment.includes("違い") &&
      !comment.includes("差") &&
      !comment.includes("温度")
    ) {
      const recentContent = humanMessages.slice(-4).map((m: any) => m.content).join(" ");
      let addition = " 今は「求めている関係性の温度差」が強く出ている状態かもしれません。";
      if (recentContent.includes("不安")) {
        addition = " 今は「不安をどう扱うか」という、感覚ではなく言葉にしたい段階に来ている感じがあります。";
      } else if (recentContent.includes("連絡") || recentContent.includes("LINE")) {
        addition = " 問題は連絡頻度そのものではなく、「優先されている感覚のズレ」かもしれません。";
      } else if (recentContent.includes("安心") || recentContent.includes("縛")) {
        addition = " 今は「安心したい気持ち」と「縛られたくない気持ち」がぶつかっています。";
      }
      comment += addition;
    }

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