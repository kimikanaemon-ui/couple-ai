"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #FDF6F9 0%, #F4F9FF 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap');
        @keyframes fadein { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .card { animation: fadein 0.5s ease both; }
        .card:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 12px 40px rgba(0,0,0,.10) !important; }
        .card { transition: transform .25s ease, box-shadow .25s ease; }
      `}</style>

      {/* ロゴ */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🤝</div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#2a1a2a", margin: 0 }}>
          Counseling AI
        </h1>
        <p style={{ fontSize: 13, color: "#b89aab", marginTop: 8 }}>
          安心して話せる場所を、AIが用意します
        </p>
      </div>

      {/* カード選択 */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>

        {/* カップル */}
        <div className="card"
          onClick={() => router.push("/couple")}
          style={{ width: 220, background: "white", borderRadius: 24, border: "0.5px solid #f0dde6", padding: "32px 24px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 20px rgba(212,83,126,.08)", animationDelay: "0s" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💑</div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#3a2030", margin: "0 0 8px" }}>
            Couple
          </h2>
          <p style={{ fontSize: 12, color: "#b89aab", lineHeight: 1.6, margin: "0 0 20px" }}>
            パートナーとの対話を<br/>AIがやさしく整理します
          </p>
          <div style={{ background: "#D4537E", color: "white", borderRadius: 20, padding: "8px 0", fontSize: 12, fontWeight: 500 }}>
            はじめる →
          </div>
        </div>

        {/* 親子 */}
        <div className="card"
          onClick={() => router.push("/parent-child")}
          style={{ width: 220, background: "white", borderRadius: 24, border: "0.5px solid #f0e4d0", padding: "32px 24px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 20px rgba(224,123,42,.08)", animationDelay: "0.1s" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌳</div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#3a2a1a", margin: "0 0 8px" }}>
            Family
          </h2>
          <p style={{ fontSize: 12, color: "#c4a882", lineHeight: 1.6, margin: "0 0 20px" }}>
            親子の対話を<br/>AIがやさしく整理します
          </p>
          <div style={{ background: "#E07B2A", color: "white", borderRadius: 20, padding: "8px 0", fontSize: 12, fontWeight: 500 }}>
            はじめる →
          </div>
        </div>

      </div>

      <p style={{ fontSize: 11, color: "#d0c0cc", marginTop: 40 }}>
        会話内容は外部に保存されません
      </p>
    </main>
  );
}