"use client";

import { useState, useRef, useEffect } from "react";

type Role = "user" | "partner" | "assistant";

type Message = {
  role: Role;
  content: string;
};

type PersonScores = {
  anger: number;
  sadness: number;
  anxiety: number;
  understanding: number;
};

type EmotionScores = {
  user: PersonScores;
  partner: PersonScores;
};

type Session = {
  id: number;
  date: string;
  messages: Message[];
  emotions?: EmotionScores;
  keywords?: string[];
  issues?: string[];
};

type MoodKey = "conflict" | "tension" | "neutral" | "calm" | "warm";

const MOODS: Record<MoodKey, { color: string; label: string; sub: string }> = {
  conflict: { color: "#E24B4A", label: "Conflict",         sub: "Strong emotions present" },
  tension:  { color: "#D4537E", label: "Tension",          sub: "Some friction detected" },
  neutral:  { color: "#EF9F27", label: "Neutral",          sub: "Conversation is stable" },
  calm:     { color: "#639922", label: "Calm",             sub: "Relaxed and open" },
  warm:     { color: "#ED93B1", label: "Warm connection",  sub: "Closeness and understanding" },
};

// interventionType → mood のマッピング
const TYPE_TO_MOOD: Record<string, MoodKey> = {
  mediate:    "conflict",
  clarify:    "tension",
  facilitate: "neutral",
  encourage:  "calm",
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [emotionScores, setEmotionScores] = useState<EmotionScores | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaker, setSpeaker] = useState<"user" | "partner">("user");
  const [interventionType, setInterventionType] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodKey>("neutral");
  const [showSessions, setShowSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const saved = localStorage.getItem("couple-ai-sessions");
    if (saved) setSessions(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("couple-ai-sessions", JSON.stringify(sessions));
  }, [sessions]);

  const speak = (text: string, emotion: "calm" | "tense" = "calm") => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find(v =>
        v.lang === "ja-JP" &&
        (v.name.includes("Google") || v.name.includes("Kyoko") ||
         v.name.includes("Siri") || v.name.includes("Microsoft"))
      ) || voices.find(v => v.lang === "ja-JP");
    const sentences = text
      .split(/(?<=[。？！\n])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    const rate = emotion === "tense" ? 1.0 : 0.8;
    sentences.forEach(sentence => {
      const u = new SpeechSynthesisUtterance();
      u.lang = "ja-JP";
      u.volume = 1;
      u.rate = rate;
      u.pitch = 0.85;
      if (voice) u.voice = voice;
      u.text = sentence.replace(/、/g, "、…");
      window.speechSynthesis.speak(u);
    });
  };

  // キーワードでリアルタイムにムードを判定
  const detectMood = (msgs: Message[]): MoodKey => {
    const recent = msgs.slice(-4).map(m => m.content).join(" ");

    const keywords: Record<MoodKey, string[]> = {
      conflict: ["怒","ふざけ","最悪","無視","うるさい","嫌い","もう終わり","裏切","許せない","責め","なんで","絶対","いつも","全然","どうせ"],
      tension:  ["悲しい","寂しい","傷","つらい","不安","心配","怖い","泣","わかってくれない","伝わらない","疲れた","もう","なんか"],
      warm:     ["ありがとう","嬉しい","好き","愛","大切","幸せ","一緒","支え","わかった","ごめん","反省","これから","がんばる"],
      calm:     ["そうだね","なるほど","理解","落ち着","整理","確かに","そっか","うん","大丈夫"],
      neutral:  [],
    };

    const scores: Record<MoodKey, number> = { conflict: 0, tension: 0, warm: 0, calm: 0, neutral: 0 };
    for (const [key, words] of Object.entries(keywords) as [MoodKey, string[]][]) {
      for (const word of words) {
        if (recent.includes(word)) scores[key]++;
      }
    }

    const top = (Object.entries(scores) as [MoodKey, number][])
      .sort((a, b) => b[1] - a[1])[0];

    return top[1] > 0 ? top[0] : "neutral";
  };

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("このブラウザは音声入力に対応していません"); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? prev + " " + transcript : transcript);
    };
    recognition.start();
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const newMessages: Message[] = [...messages, { role: speaker, content: input }];
    setMessages(newMessages);
    setInput("");
    setSpeaker(prev => prev === "user" ? "partner" : "user");
    setInterventionType(null);

    // キーワードでリアルタイムにムード更新
    setMood(detectMood(newMessages));

    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (data.shouldIntervene && data.reply) {
        setInterventionType(data.interventionType);
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
        // mood を自動更新
        if (data.interventionType && TYPE_TO_MOOD[data.interventionType]) {
          setMood(TYPE_TO_MOOD[data.interventionType]);
        }
        const emotion = data.interventionType === "mediate" || data.interventionType === "clarify" ? "tense" : "calm";
        speak(data.reply, emotion);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (messages.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, isEndSession: true }),
      });
      const data = await res.json();
      if (data.emotions) setEmotionScores(data.emotions);
      if (data.keywords) setKeywords(data.keywords);
      if (data.issues) setIssues(data.issues);
      const finalMessages: Message[] = [
        ...messages,
        { role: "assistant", content: "【セッションまとめ】\n\n" + data.reply },
      ];
      setMessages(finalMessages);
      setSessions(prev => [{
        id: Date.now(), date: new Date().toLocaleString(),
        messages: finalMessages, emotions: data.emotions,
        keywords: data.keywords, issues: data.issues,
      }, ...prev]);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const loadSession = (session: Session) => {
    setMessages(session.messages);
    if (session.emotions) setEmotionScores(session.emotions);
    setKeywords(session.keywords || []);
    setIssues(session.issues || []);
    setShowSessions(false);
  };

  const newSession = () => {
    setMessages([]); setEmotionScores(null);
    setKeywords([]); setIssues([]);
    setSpeaker("user"); setMood("neutral");
  };

  const currentMood = MOODS[mood];

  const typeStyle: Record<string, { icon: string; bg: string; text: string; border: string }> = {
    mediate:    { icon: "🛑", bg: "#FCEBEB", text: "#A32D2D", border: "#F7C1C1" },
    facilitate: { icon: "💬", bg: "#E6F1FB", text: "#185FA5", border: "#B5D4F4" },
    clarify:    { icon: "🔍", bg: "#FAEEDA", text: "#854F0B", border: "#FAC775" },
    encourage:  { icon: "✨", bg: "#EAF3DE", text: "#3B6D11", border: "#C0DD97" },
  };

  return (
    <main style={{ minHeight: "100vh", background: "#FDF6F9", display: "flex", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap');
        @keyframes heartbeat { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:.15} 50%{transform:scale(1.2);opacity:.28} }
        @keyframes fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .msg-fadein { animation: fadein 0.3s ease }
        .heart-svg { animation: heartbeat 2.8s ease-in-out infinite }
        .heart-ring { animation: pulse 2.8s ease-in-out infinite }
        textarea:focus { outline: none }
        ::-webkit-scrollbar { width: 4px }
        ::-webkit-scrollbar-thumb { background: #f0c0d0; border-radius: 4px }
      `}</style>

      {/* 左パネル */}
      <div style={{ width: 200, background: "white", borderRight: "0.5px solid #f0dde6", display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 16px", gap: 20, position: "sticky", top: 0, height: "100vh" }}>

        <span style={{ fontSize: 10, color: "#b89aab", letterSpacing: ".1em", textTransform: "uppercase", textAlign: "center" }}>Relationship<br/>atmosphere</span>

        {/* ハートムード */}
        <div style={{ position: "relative", width: 110, height: 110, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="heart-ring" style={{ position: "absolute", width: 110, height: 110, borderRadius: "50%", background: currentMood.color }} />
          <svg className="heart-svg" width="72" height="66" viewBox="0 0 72 66" fill="none" style={{ position: "relative", zIndex: 1, filter: `drop-shadow(0 4px 18px ${currentMood.color}66)` }}>
            <path d="M36 62S4 42 4 20C4 10 12 3 22 3c6 0 11 3 14 8 3-5 8-8 14-8 10 0 18 7 18 17C68 42 36 62 36 62Z" fill={currentMood.color} />
            <path d="M22 14c-3 0-6 2-8 5" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity=".45" />
          </svg>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#3a2030" }}>{currentMood.label}</div>
          <div style={{ fontSize: 11, color: "#b89aab", marginTop: 2 }}>{currentMood.sub}</div>
        </div>

        {/* ムード手動切替ドット */}
        <div style={{ display: "flex", gap: 6 }}>
          {(Object.entries(MOODS) as [MoodKey, typeof MOODS[MoodKey]][]).map(([key, m]) => (
            <div key={key} onClick={() => setMood(key)}
              title={m.label}
              style={{ width: 9, height: 9, borderRadius: "50%", background: m.color, cursor: "pointer", transition: "transform .2s", outline: mood === key ? `2px solid ${m.color}` : "none", outlineOffset: 2 }} />
          ))}
        </div>

        <div style={{ width: "100%", height: "0.5px", background: "#f0dde6" }} />

        {/* 参加者 */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { initial: "A", label: "あなた", bg: "#FBEAF0", color: "#993556" },
            { initial: "P", label: "パートナー", bg: "#E6F1FB", color: "#185FA5" },
            { initial: "AI", label: "Counselor AI", bg: "#F1EFE8", color: "#5F5E5A" },
          ].map(p => (
            <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: p.bg, color: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, flexShrink: 0 }}>{p.initial}</div>
              <span style={{ fontSize: 12, color: "#7a6070" }}>{p.label}</span>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#63c76e", marginLeft: "auto" }} />
            </div>
          ))}
        </div>

        <div style={{ width: "100%", height: "0.5px", background: "#f0dde6" }} />

        {/* 履歴ボタン */}
        <button onClick={() => setShowSessions(v => !v)}
          style={{ width: "100%", padding: "7px 0", borderRadius: 20, border: "0.5px solid #f0dde6", background: "white", fontSize: 11, color: "#b89aab", cursor: "pointer" }}>
          履歴 {sessions.length > 0 && `(${sessions.length})`}
        </button>

        <button onClick={newSession}
          style={{ width: "100%", padding: "7px 0", borderRadius: 20, border: "none", background: currentMood.color, color: "white", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
          新規セッション
        </button>
      </div>

      {/* 履歴パネル */}
      {showSessions && (
        <div style={{ width: 220, background: "white", borderRight: "0.5px solid #f0dde6", overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#b89aab", marginBottom: 4 }}>セッション履歴</div>
          {sessions.length === 0 && <p style={{ fontSize: 12, color: "#d0c0cc" }}>まだ保存がありません</p>}
          {sessions.map(s => (
            <button key={s.id} onClick={() => loadSession(s)}
              style={{ textAlign: "left", padding: "10px 12px", borderRadius: 12, border: "0.5px solid #f0dde6", background: "white", cursor: "pointer", width: "100%" }}>
              <div style={{ fontSize: 10, color: "#b89aab" }}>{s.date}</div>
              {s.keywords && s.keywords.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {s.keywords.slice(0, 3).map((kw, i) => (
                    <span key={i} style={{ background: "#FBEAF0", color: "#993556", fontSize: 10, padding: "2px 8px", borderRadius: 20 }}>{kw}</span>
                  ))}
                </div>
              )}
              {s.issues && s.issues.length > 0 && (
                <div style={{ fontSize: 10, color: "#b89aab", marginTop: 4 }}>⚡ {s.issues[0]}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* メインチャット */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "24px 24px" }}>
        <div style={{ width: "100%", maxWidth: 560, background: "white", borderRadius: 24, border: "0.5px solid #f0dde6", display: "flex", flexDirection: "column", height: "calc(100vh - 48px)", boxShadow: "0 2px 24px rgba(212,83,126,.06)" }}>

          {/* ヘッダー */}
          <div style={{ padding: "18px 24px", borderBottom: "0.5px solid #f0dde6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "#3a2030" }}>Couple Counseling</span>
            <span style={{ fontSize: 11, padding: "3px 12px", borderRadius: 20, background: speaker === "user" ? "#FBEAF0" : "#E6F1FB", color: speaker === "user" ? "#993556" : "#185FA5", fontWeight: 500 }}>
              {speaker === "user" ? "あなたの番" : "パートナーの番"}
            </span>
          </div>

          {/* 感情スコア（セッション終了後） */}
          {(emotionScores || keywords.length > 0 || issues.length > 0) && (
            <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #f0dde6", display: "flex", flexDirection: "column", gap: 10 }}>
              {keywords.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#b89aab", marginRight: 4 }}>🏷</span>
                  {keywords.map((kw, i) => (
                    <span key={i} style={{ background: "#FBEAF0", color: "#993556", fontSize: 11, padding: "2px 10px", borderRadius: 20, border: "0.5px solid #F4C0D1" }}>{kw}</span>
                  ))}
                </div>
              )}
              {issues.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {issues.map((issue, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#854F0B", background: "#FAEEDA", padding: "3px 10px", borderRadius: 8 }}>⚡ {issue}</div>
                  ))}
                </div>
              )}
              {emotionScores && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(["user", "partner"] as const).map(key => (
                    <div key={key}>
                      <div style={{ fontSize: 10, color: "#b89aab", marginBottom: 4 }}>{key === "user" ? "あなた" : "パートナー"}</div>
                      {(["anger", "sadness", "anxiety", "understanding"] as const).map(id => {
                        const emojis = { anger: "😡", sadness: "😢", anxiety: "😰", understanding: "🤝" };
                        const colors = { user: "#D4537E", partner: "#378ADD" };
                        return (
                          <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            <span style={{ width: 60, fontSize: 10, color: "#b89aab", flexShrink: 0 }}>{emojis[id]} {id}</span>
                            <div style={{ flex: 1, background: "#f5eef2", borderRadius: 4, height: 6 }}>
                              <div style={{ width: `${(emotionScores[key][id] / 10) * 100}%`, background: colors[key], height: 6, borderRadius: 4, transition: "width .5s" }} />
                            </div>
                            <span style={{ fontSize: 10, color: "#b89aab", width: 28, textAlign: "right" }}>{emotionScores[key][id]}/10</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* メッセージ */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "#d0c0cc", fontSize: 13, marginTop: 40 }}>
                まず「あなた」から気持ちを書いてください
              </div>
            )}
            {messages.map((m, i) => {
              if (m.role === "assistant") {
                const ts = interventionType && i === messages.length - 1 && typeStyle[interventionType]
                  ? typeStyle[interventionType]
                  : { icon: "💭", bg: "#F1EFE8", text: "#5F5E5A", border: "#D3D1C7" };
                return (
                  <div key={i} className="msg-fadein" style={{ display: "flex", justifyContent: "center" }}>
                    <div style={{ maxWidth: "85%", padding: "10px 16px", borderRadius: 14, border: `0.5px solid ${ts.border}`, background: ts.bg, color: ts.text, fontSize: 12, fontStyle: "italic", textAlign: "center", lineHeight: 1.6 }}>
                      {ts.icon} {m.content}
                    </div>
                  </div>
                );
              }
              const isUser = m.role === "user";
              return (
                <div key={i} className="msg-fadein" style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 10, alignItems: "flex-end" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: isUser ? "#FBEAF0" : "#E6F1FB", color: isUser ? "#993556" : "#185FA5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
                    {isUser ? "A" : "P"}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#b89aab", marginBottom: 3, textAlign: isUser ? "right" : "left" }}>
                      {isUser ? "あなた" : "パートナー"}
                    </div>
                    <div style={{ maxWidth: 260, padding: "10px 14px", borderRadius: 16, borderBottomRightRadius: isUser ? 4 : 16, borderBottomLeftRadius: isUser ? 16 : 4, background: isUser ? "#F4C0D1" : "#B5D4F4", color: isUser ? "#4B1528" : "#042C53", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })}
            {loading && (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{ padding: "8px 18px", borderRadius: 12, background: "#F1EFE8", fontSize: 11, color: "#b89aab" }}>AIが判断中…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* セッション終了 */}
          <div style={{ padding: "0 20px 8px" }}>
            <button onClick={endSession} style={{ width: "100%", padding: "9px 0", borderRadius: 20, border: "0.5px solid #f0dde6", background: "white", fontSize: 12, color: "#b89aab", cursor: "pointer" }}>
              セッション終了してまとめる
            </button>
          </div>

          {/* 手動切替 */}
          <div style={{ padding: "0 20px 8px", display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#d0c0cc" }}>手動：</span>
            {(["user", "partner"] as const).map(s => (
              <button key={s} onClick={() => setSpeaker(s)}
                style={{ padding: "4px 14px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 500, cursor: "pointer", background: speaker === s ? (s === "user" ? "#D4537E" : "#378ADD") : "#f5eef2", color: speaker === s ? "white" : "#b89aab", transition: "all .2s" }}>
                {s === "user" ? "あなた" : "パートナー"}
              </button>
            ))}
          </div>

          {/* 入力エリア */}
          <div style={{ borderTop: "0.5px solid #f0dde6", padding: "12px 16px", display: "flex", gap: 8, alignItems: "flex-end", background: speaker === "user" ? "#fff9fb" : "#f6f9ff", borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={speaker === "user" ? "あなたの気持ちを書いてください…" : "パートナーの気持ちを書いてください…"}
              rows={2}
              style={{ flex: 1, border: `0.5px solid ${speaker === "user" ? "#F4C0D1" : "#B5D4F4"}`, borderRadius: 16, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", resize: "none", background: "white", color: "#3a2030", lineHeight: 1.5 }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button onClick={startListening}
                style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: listening ? "#E24B4A" : "#f5eef2", color: listening ? "white" : "#b89aab", fontSize: 16, cursor: "pointer" }}>
                🎤
              </button>
              <button onClick={sendMessage} disabled={loading}
                style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: speaker === "user" ? "#D4537E" : "#378ADD", color: "white", fontSize: 16, cursor: "pointer", opacity: loading ? 0.5 : 1 }}>
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
