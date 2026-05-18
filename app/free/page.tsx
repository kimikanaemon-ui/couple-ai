"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Step = "user" | "partner" | "result";

type TranslationResult = {
  translatedUserFeelings: string;
  translatedPartnerFeelings: string;
  sessionTheme: string;
  sessionGoal: string;
  coreConflict: string;
  nextStepHint: string;
};

export default function FreePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("user");
  const [userDump, setUserDump] = useState("");
  const [partnerDump, setPartnerDump] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = (setter: (v: string) => void, current: string) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("このブラウザは音声入力に対応していません"); return; }

    // 既に動いていれば停止
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
      return;
    }

    const r = new SR();
    r.lang = "ja-JP";
    r.continuous = true;
    r.interimResults = true;
    recognitionRef.current = r;

    let committed = current; // 確定済みテキストを保持
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    r.onstart = () => setListening(true);

    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          committed += t;
        } else {
          interim = t;
        }
      }
      setter(committed + interim);
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => r.stop(), 20000);
    };

    r.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      if (silenceTimer) clearTimeout(silenceTimer);
      setter(committed);
    };

    r.onerror = () => { setListening(false); recognitionRef.current = null; };
    r.start();
  };

  const handleTranslate = async () => {
    if (!userDump.trim() || !partnerDump.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/free-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userDump, partnerDump }),
      });
      const data = await res.json();
      setResult(data);
      setStep("result");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", border: "0.5px solid #f0dde6", borderRadius: 14,
    padding: "12px 14px", fontSize: 14, fontFamily: "inherit",
    resize: "none" as const, outline: "none" as const,
    background: "white", color: "#3a2030", lineHeight: 1.6,
  };

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #FDF6F9 0%, #F4F9FF 100%)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 24px", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap'); * { box-sizing: border-box; } textarea:focus,input:focus{outline:none}`}</style>

      <div style={{ width: "100%", maxWidth: 520 }}>

        {/* ヘッダー */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
          <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: "#3a2030", margin: 0 }}>気持ちを翻訳する</h1>
          <p style={{ fontSize: 13, color: "#b89aab", marginTop: 8 }}>まずそれぞれが本音を書いてください。AIが翻訳します。</p>
        </div>

        {/* ステップインジケーター */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
          {(["user","partner","result"] as Step[]).map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, background: step === s ? "#D4537E" : ["user","partner","result"].indexOf(step) > i ? "#EAF3DE" : "#f5eef2", color: step === s ? "white" : ["user","partner","result"].indexOf(step) > i ? "#3B6D11" : "#b89aab" }}>
                {["user","partner","result"].indexOf(step) > i ? "✓" : i + 1}
              </div>
              {i < 2 && <div style={{ width: 24, height: 1, background: "#f0dde6" }} />}
            </div>
          ))}
        </div>

        <div style={{ background: "white", borderRadius: 24, border: "0.5px solid #f0dde6", padding: 28, boxShadow: "0 4px 24px rgba(212,83,126,.06)" }}>

          {/* Step 1: あなた */}
          {step === "user" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "#b89aab", marginBottom: 6, letterSpacing: ".05em", textTransform: "uppercase" }}>Step 1</div>
                <h2 style={{ fontSize: 17, color: "#3a2030", margin: 0 }}>あなたの本音を書いてください</h2>
                <p style={{ fontSize: 12, color: "#b89aab", marginTop: 6 }}>パートナーには見せません。思ったままで大丈夫です。</p>
              </div>
              <div style={{ position: "relative" }}>
                <textarea placeholder="モヤモヤしていること、言えなかったこと、怒り、悲しみ…なんでも。" rows={8} value={userDump} onChange={e => setUserDump(e.target.value)} style={{...inputStyle, paddingRight: 48}} />
                <button onClick={() => startListening(setUserDump, userDump)}
                  style={{ position: "absolute", bottom: 10, right: 10, width: 32, height: 32, borderRadius: "50%", border: "none", background: listening ? "#E24B4A" : "#f5eef2", color: listening ? "white" : "#b89aab", fontSize: 14, cursor: "pointer" }}>
                  {listening ? "⏹" : "🎤"}
                </button>
              </div>
              <button onClick={() => setStep("partner")} disabled={!userDump.trim()}
                style={{ padding: "14px 0", borderRadius: 16, border: "none", background: userDump.trim() ? "#D4537E" : "#f5eef2", color: userDump.trim() ? "white" : "#d0c0cc", fontSize: 14, fontWeight: 500, cursor: userDump.trim() ? "pointer" : "default" }}>
                次へ →
              </button>
            </div>
          )}

          {/* Step 2: パートナー */}
          {step === "partner" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "#b89aab", marginBottom: 6, letterSpacing: ".05em", textTransform: "uppercase" }}>Step 2</div>
                <h2 style={{ fontSize: 17, color: "#3a2030", margin: 0 }}>パートナーの本音を書いてください</h2>
                <p style={{ fontSize: 12, color: "#b89aab", marginTop: 6 }}>パートナー本人が入力するか、代わりに書いてください。</p>
              </div>
              <div style={{ position: "relative" }}>
                <textarea placeholder="パートナーの立場から…" rows={8} value={partnerDump} onChange={e => setPartnerDump(e.target.value)} style={{...inputStyle, paddingRight: 48}} />
                <button onClick={() => startListening(setPartnerDump, partnerDump)}
                  style={{ position: "absolute", bottom: 10, right: 10, width: 32, height: 32, borderRadius: "50%", border: "none", background: listening ? "#E24B4A" : "#f5eef2", color: listening ? "white" : "#b89aab", fontSize: 14, cursor: "pointer" }}>
                  {listening ? "⏹" : "🎤"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("user")}
                  style={{ flex: 1, padding: "14px 0", borderRadius: 16, border: "0.5px solid #f0dde6", background: "white", color: "#b89aab", fontSize: 14, cursor: "pointer" }}>
                  ← 戻る
                </button>
                <button onClick={handleTranslate} disabled={!partnerDump.trim() || loading}
                  style={{ flex: 2, padding: "14px 0", borderRadius: 16, border: "none", background: partnerDump.trim() && !loading ? "#D4537E" : "#f5eef2", color: partnerDump.trim() && !loading ? "white" : "#d0c0cc", fontSize: 14, fontWeight: 500, cursor: partnerDump.trim() && !loading ? "pointer" : "default" }}>
                  {loading ? "翻訳中…" : "翻訳する ✨"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: 結果 */}
          {step === "result" && result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#b89aab", marginBottom: 6, letterSpacing: ".05em", textTransform: "uppercase" }}>翻訳結果</div>
                <h2 style={{ fontSize: 17, color: "#3a2030", margin: 0 }}>今二人の間で起きていること</h2>
              </div>

              {/* コアコンフリクト */}
              <div style={{ background: "linear-gradient(135deg,#FBEAF0,#E6F1FB)", borderRadius: 16, padding: "16px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#993556", marginBottom: 6 }}>核心</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "#3a2030" }}>{result.coreConflict}</div>
              </div>

              {/* あなたの翻訳 */}
              <div style={{ background: "#FBEAF0", borderRadius: 16, padding: "16px 20px" }}>
                <div style={{ fontSize: 11, color: "#993556", marginBottom: 8 }}>💗 あなたの本当の気持ち</div>
                <p style={{ fontSize: 13, color: "#4B1528", lineHeight: 1.7, margin: 0 }}>{result.translatedUserFeelings}</p>
              </div>

              {/* パートナーの翻訳 */}
              <div style={{ background: "#E6F1FB", borderRadius: 16, padding: "16px 20px" }}>
                <div style={{ fontSize: 11, color: "#185FA5", marginBottom: 8 }}>💙 パートナーの本当の気持ち</div>
                <p style={{ fontSize: 13, color: "#042C53", lineHeight: 1.7, margin: 0 }}>{result.translatedPartnerFeelings}</p>
              </div>

              {/* テーマ・ゴール */}
              <div style={{ background: "#F1EFE8", borderRadius: 16, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#5F5E5A", marginBottom: 4 }}>📌 今日のテーマ</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#3a2030" }}>{result.sessionTheme}</div>
                </div>
                <div style={{ height: "0.5px", background: "#d8d5cc" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#5F5E5A", marginBottom: 4 }}>🎯 目指せること</div>
                  <div style={{ fontSize: 14, color: "#3a2030" }}>{result.sessionGoal}</div>
                </div>
              </div>

              {/* 次のステップヒント */}
              {result.nextStepHint && (
                <div style={{ background: "linear-gradient(135deg,#EAF3DE,#E6F1FB)", borderRadius: 16, padding: "16px 20px" }}>
                  <div style={{ fontSize: 11, color: "#3B6D11", marginBottom: 8 }}>💡 これから解決できそうなこと</div>
                  <p style={{ fontSize: 13, color: "#2a3a2a", lineHeight: 1.7, margin: 0 }}>{result.nextStepHint}</p>
                </div>
              )}

              {/* ボタン */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => {
                    const params = new URLSearchParams({
                      theme: result.sessionTheme,
                      goal: result.sessionGoal,
                      conflict: result.coreConflict,
                    });
                    router.push(`/couple?${params.toString()}`);
                  }}
                  style={{ padding: "14px 0", borderRadius: 16, border: "none", background: "#D4537E", color: "white", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                  二人で対話を始める（有料版）→
                </button>
                <button onClick={() => { setStep("user"); setUserDump(""); setPartnerDump(""); setResult(null); }}
                  style={{ padding: "12px 0", borderRadius: 16, border: "0.5px solid #f0dde6", background: "white", color: "#b89aab", fontSize: 13, cursor: "pointer" }}>
                  もう一度やり直す
                </button>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#d0c0cc", marginTop: 20 }}>
          入力内容は外部に保存されません
        </p>
      </div>
    </main>
  );
}