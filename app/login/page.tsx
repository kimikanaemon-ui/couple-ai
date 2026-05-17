"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push("/");
    });
  }, [router]);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #FDF6F9 0%, #F4F9FF 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap');`}</style>

      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "#2a1a2a", margin: 0 }}>Counseling AI</h1>
        <p style={{ fontSize: 13, color: "#b89aab", marginTop: 8 }}>ログインしてセッション履歴を保存</p>
      </div>

      <div style={{ background: "white", borderRadius: 24, border: "0.5px solid #f0dde6", padding: "36px 32px", width: "100%", maxWidth: 360, boxShadow: "0 4px 24px rgba(212,83,126,.08)", textAlign: "center" }}>
        <button onClick={handleGoogleLogin}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "14px 0", borderRadius: 20, border: "0.5px solid #e0e0e0", background: "white", cursor: "pointer", fontSize: 14, fontWeight: 500, color: "#3a3a3a" }}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google でログイン
        </button>
        <p style={{ fontSize: 11, color: "#d0c0cc", marginTop: 20, lineHeight: 1.6 }}>
          ログインするとセッション履歴が<br/>クラウドに保存されます
        </p>
      </div>
    </main>
  );
}