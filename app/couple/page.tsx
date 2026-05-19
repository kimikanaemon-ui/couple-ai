"use client";

import { useState, useRef } from "react";

type Message = {
  role: "user" | "partner" | "ai";
  text: string;
};

export default function CouplePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text:
        "こんにちは。今日は二人の会話を整理していきます。まず、今いちばんモヤモヤしていることを教えてください。",
    },
  ]);

  const [input, setInput] = useState("");
  const [speaker, setSpeaker] = useState<"user" | "partner">("user");

  const [loading, setLoading] = useState(false);

  const [listening, setListening] = useState(false);

  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SR) {
      alert("このブラウザは音声入力に対応していません");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
      return;
    }

    const recognition = new SR();

    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognitionRef.current = recognition;

    let finalTranscript = input;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setInput(finalTranscript + interimTranscript);
    };

    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      setInput(finalTranscript);
    };

    recognition.start();
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessages: Message[] = [
      ...messages,
      {
        role: speaker,
        text: input,
      },
    ];

    setMessages(newMessages);

    const currentInput = input;

    setInput("");

    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      const data = await res.json();

      setMessages([
        ...newMessages,
        {
          role: "ai",
          text: data.reply,
        },
      ]);

      setSpeaker(speaker === "user" ? "partner" : "user");
    } catch (e) {
      console.error(e);

      setMessages([
        ...newMessages,
        {
          role: "ai",
          text: "通信エラーが発生しました。",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg,#FDF6F9 0%,#F4F9FF 100%)",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 700,
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            marginBottom: 24,
            color: "#3a2030",
          }}
        >
          💑 カップル対話
        </h1>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf:
                  m.role === "ai"
                    ? "center"
                    : m.role === "user"
                    ? "flex-start"
                    : "flex-end",

                background:
                  m.role === "ai"
                    ? "#fff"
                    : m.role === "user"
                    ? "#FBEAF0"
                    : "#E6F1FB",

                padding: "14px 16px",
                borderRadius: 18,
                maxWidth: "85%",
                lineHeight: 1.7,
                fontSize: 14,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.text}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <button
            onClick={() => setSpeaker("user")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 14,
              border:
                speaker === "user"
                  ? "2px solid #D4537E"
                  : "1px solid #ddd",
              background:
                speaker === "user"
                  ? "#FBEAF0"
                  : "white",
            }}
          >
            👩 あなた
          </button>

          <button
            onClick={() => setSpeaker("partner")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 14,
              border:
                speaker === "partner"
                  ? "2px solid #4A90E2"
                  : "1px solid #ddd",
              background:
                speaker === "partner"
                  ? "#E6F1FB"
                  : "white",
            }}
          >
            👨 相手
          </button>
        </div>

        <div
          style={{
            position: "relative",
          }}
        >
          <textarea
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="今の気持ちを入力してください"
            style={{
              width: "100%",
              borderRadius: 18,
              border: "1px solid #ddd",
              padding: "16px 52px 16px 16px",
              resize: "none",
              fontSize: 14,
              lineHeight: 1.7,
            }}
          />

          <button
            onClick={startListening}
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              background: listening ? "#E24B4A" : "#f3f3f3",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            {listening ? "⏹" : "🎤"}
          </button>
        </div>

        <button
          onClick={sendMessage}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 12,
            padding: 16,
            borderRadius: 18,
            border: "none",
            background: "#D4537E",
            color: "white",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "AIが整理中…" : "送信する"}
        </button>
      </div>
    </main>
  );
}