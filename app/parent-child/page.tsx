"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Role = "parent" | "child" | "assistant";

type Message = {
  role: Role;
  content: string;
};

function ParentChildPageContent() {
  const searchParams = useSearchParams();

  const preTheme = searchParams.get("theme") || "";
  const preGoal = searchParams.get("goal") || "";
  const preConflict = searchParams.get("conflict") || "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [speaker, setSpeaker] = useState<"parent" | "child">("parent");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const newMessages: Message[] = [
      ...messages,
      {
        role: speaker,
        content: input,
      },
    ];

    setMessages(newMessages);
    setInput("");

    setSpeaker((prev) =>
      prev === "parent" ? "child" : "parent"
    );

    setLoading(true);

    try {
      const res = await fetch("/api/family-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply,
          },
        ]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FDF9F4",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 700,
          height: "90vh",
          background: "white",
          borderRadius: 24,
          border: "1px solid #f0e4d0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* header */}
        <div
          style={{
            padding: 20,
            borderBottom: "1px solid #f0e4d0",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h1
              style={{
                fontSize: 20,
                color: "#3a2a1a",
                margin: 0,
              }}
            >
              Family Counseling
            </h1>

            <div
              style={{
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 999,
                background:
                  speaker === "parent"
                    ? "#FDE8C8"
                    : "#D4EAF7",
                color:
                  speaker === "parent"
                    ? "#854F0B"
                    : "#0C447C",
              }}
            >
              {speaker === "parent"
                ? "保護者の番"
                : "お子さんの番"}
            </div>
          </div>

          {preGoal && (
            <div
              style={{
                fontSize: 12,
                background: "#FDE8C8",
                padding: "8px 12px",
                borderRadius: 10,
              }}
            >
              🎯 {preGoal}
            </div>
          )}

          {preTheme && (
            <div
              style={{
                fontSize: 12,
                background: "#FAEEDA",
                padding: "8px 12px",
                borderRadius: 10,
              }}
            >
              💭 {preTheme}
            </div>
          )}

          {preConflict && (
            <div
              style={{
                fontSize: 12,
                background: "#FCEBEB",
                padding: "8px 12px",
                borderRadius: 10,
              }}
            >
              ⚡ {preConflict}
            </div>
          )}
        </div>

        {/* messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "#c4a882",
                marginTop: 40,
              }}
            >
              まずは気持ちを書いてみてください
            </div>
          )}

          {messages.map((m, i) => {
            if (m.role === "assistant") {
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "80%",
                      background: "#F1EFE8",
                      color: "#5F5E5A",
                      padding: "10px 14px",
                      borderRadius: 14,
                      fontSize: 13,
                      lineHeight: 1.7,
                      textAlign: "center",
                    }}
                  >
                    💭 {m.content}
                  </div>
                </div>
              );
            }

            const isParent = m.role === "parent";

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: isParent
                    ? "row"
                    : "row-reverse",
                  gap: 10,
                  alignItems: "flex-end",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: isParent
                      ? "#FDE8C8"
                      : "#D4EAF7",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {isParent ? "親" : "子"}
                </div>

                <div
                  style={{
                    maxWidth: 320,
                    padding: "12px 14px",
                    borderRadius: 16,
                    background: isParent
                      ? "#FDE8C8"
                      : "#D4EAF7",
                    color: isParent
                      ? "#5C3205"
                      : "#063450",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    fontSize: 14,
                  }}
                >
                  {m.content}
                </div>
              </div>
            );
          })}

          {loading && (
            <div
              style={{
                textAlign: "center",
                color: "#c4a882",
                fontSize: 12,
              }}
            >
              AIが考えています…
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* input */}
        <div
          style={{
            borderTop: "1px solid #f0e4d0",
            padding: 16,
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={
              speaker === "parent"
                ? "保護者の気持ちを書いてください"
                : "お子さんの気持ちを書いてください"
            }
            style={{
              flex: 1,
              resize: "none",
              borderRadius: 14,
              border: "1px solid #e8d8c2",
              padding: 12,
              fontSize: 14,
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey
              ) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "none",
              background:
                speaker === "parent"
                  ? "#E07B2A"
                  : "#378ADD",
              color: "white",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </main>
  );
}

export default function ParentChildPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#FDF9F4",
          }}
        />
      }
    >
      <ParentChildPageContent />
    </Suspense>
  );
}