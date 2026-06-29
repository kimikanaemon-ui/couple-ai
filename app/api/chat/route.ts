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

    const conversationStage = humanCount < 6 ? "listen" : humanCount < 12 ? "analyze" : "resolve";

    if (conversationStage === "listen") {
      const lastAIIndex = messages.map((m: any) => m.role).lastIndexOf("assistant");
      const sinceLastAI = lastAIIndex === -1
        ? humanCount
        : messages.slice(lastAIIndex + 1).filter((m: any) => m.role !== "assistant").length;
      if (sinceLastAI < 3) {
        return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
      }
    }

    if (humanCount < 2) {
      return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
    }

    const lastAIComment = assistantMessages.slice(-1)[0]?.content || "";
    const userCount = humanMessages.filter((m: any) => m.role === "user").length;
    const partnerCount = humanMessages.filter((m: any) => m.role === "partner").length;
    const lastSpeaker = humanMessages.slice(-1)[0]?.role;

    let consecutiveCount = 0;
    for (let i = humanMessages.length - 1; i >= 0; i--) {
      if (humanMessages[i].role === lastSpeaker) consecutiveCount++;
      else break;
    }
    const forceSwitch = consecutiveCount >= 3;

    const recentText = humanMessages.slice(-6).map((m: any) => m.content).join(" ");
    const hasMoralHarass = ["お前","うるさい","黙れ","馬鹿","消えろ","お前のせい","役に立たない","価値ない","狂ってる","被害妄想"].some(w => recentText.includes(w));
    const hasSupressed = ["私が悪い","私のせい","怒らせてしまった","言えない","怒られる","我慢するしか"].some(w => recentText.includes(w));

    const shouldSummarize = humanCount > 0 && humanCount % 5 === 0;

    const SYSTEM_BASE = `あなたは関係性を読むカップルカウンセラー兼分析者です。`;

    const SYSTEM_STAGE: Record<string, string> = {
      listen: `【ステージ：listen】
3〜4発言に1回だけ介入。会話循環を最優先。
橋渡し質問のみ（分析・解釈なし）：
「相手はその時どう受け取っていたと思いますか？」
「今の言葉、どう感じましたか？」`,

      analyze: `【ステージ：analyze】
「何と何がぶつかっているのか」を具体的に言語化。
例：「安心したい気持ちと自由でいたい気持ちのぶつかりかもしれません」
曖昧なまとめ禁止。「整理」を使う場合は必ず具体内容を続ける。`,

      resolve: `【ステージ：resolve】
歩み寄りを後押し。二人が動ける小さな一歩を提示。`,
    };

    const specialNote = hasMoralHarass
      ? `【支配的発言を検知】
発言者の心理背景を穏やかに探る：
「そのような言い方になるとき、どんな気持ちが先にありますか？」
傷つけていることへの気づきを促す。断定しない。`
      : hasSupressed
      ? `【自己抑圧を検知】
この人に伝える：
「あなたが感じていることはとても大切です」
「自分を責めすぎず、今感じていることをそのまま話してみてください」
虐げられているわけではなく、もう少し心を開いてよいと伝える。`
      : "";

    const CORE_PRINCIPLES = `【処理の順序】
1. 発言内容を要約する
2. 感情を抽出する（表面と裏）
3. 本人も気づいていないニーズを推測する
4. 思考パターン・認知の偏りを分析する
5. 必要なら研究知見を「〜という研究があります」と補足
6. 相手との対話を促進する

【原則】
- 片方の味方をしない。診断しない。断定しない
- 解決策より「理解された感覚」を優先
- 心理学用語を使わず自然な言葉で
- 質問は1回に1つ。必要な時だけ
${shouldSummarize ? "- 【5ターン要約】ここまでを2〜3文でまとめてから介入する" : ""}`;

    const systemContent = `${SYSTEM_BASE}

${SYSTEM_STAGE[conversationStage]}
${specialNote ? "\n" + specialNote : ""}
${CORE_PRINCIPLES}

【中立性】
- 「モラハラ」「DV」「依存」等のラベルを断定しない

【状況】あなた：${userCount}回 / パートナー：${partnerCount}回 / 直前AI：「${lastAIComment.slice(0, 30)}」
${forceSwitch ? "【強制切替】3回連続 → 必ず相手へ" : ""}
${introData.userName ? `【基本情報】あなた:${introData.userName} / パートナー:${introData.partnerName} / 関係:${introData.relationship}` : ""}
${preConflict ? `【事前把握】${preConflict}` : ""}

【nextSpeaker判断】
優先1:AIの質問に未回答→同じ人 / 優先2:深掘り中→同じ人 / 優先3:3連続→切替 / 優先4:その他→切替
"user" または "partner"

【介入タイプ】facilitate/mediate/clarify/encourage/translate/reflect/support/explore

【出力】JSONのみ：
{"type":"facilitate","comment":"自然な一言","nextSpeaker":"partner"}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemContent },
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
    console.log("Couple AI:", raw);

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

    for (const word of ["モラハラ","毒親","依存","自己愛","発達障害","パワハラ","ガスライティング","DV"]) {
      if (comment.includes(word)) comment = comment.replace(word, "そう受け取られている状況");
    }

    if (comment.includes("整理") && !comment.includes("ぶつか") && !comment.includes("ズレ") && !comment.includes("違い")) {
      const rc = humanMessages.slice(-4).map((m: any) => m.content).join(" ");
      comment += rc.includes("不安") ? " 今は「不安をどう扱うか」という段階に来ている感じがします。"
        : rc.includes("連絡") ? " 問題は連絡頻度ではなく「優先されている感覚のズレ」かもしれません。"
        : " 今は「求めている関係性の温度差」が強く出ている状態かもしれません。";
    }

    if (!comment) {
      comment = `「${humanMessages.slice(-1)[0]?.content?.slice(0, 15) || ""}」について、どんな気持ちがありますか？`;
    }

    return Response.json({ shouldIntervene: true, interventionType, reply: comment, nextSpeaker });

  } catch (error) {
    console.error(error);
    return Response.json({ shouldIntervene: false, interventionType: "none", reply: null });
  }
}