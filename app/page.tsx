"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Role = "user" | "partner" | "assistant";
type Message = { role: Role; content: string };
type PersonScores = { anger: number; sadness: number; anxiety: number; understanding: number };
type EmotionScores = { user: PersonScores; partner: PersonScores };
type Session = { id: number; date: string; messages: Message[]; emotions?: EmotionScores; keywords?: string[]; issues?: string[] };
type MoodKey = "conflict" | "tension" | "neutral" | "calm" | "warm";

const MOODS: Record<MoodKey, { color: string; label: string; sub: string }> = {
  conflict: { color: "#E24B4A", label: "Conflict",        sub: "Strong emotions present" },
  tension:  { color: "#D4537E", label: "Tension",         sub: "Some friction detected" },
  neutral:  { color: "#EF9F27", label: "Neutral",         sub: "Conversation is stable" },
  calm:     { color: "#639922", label: "Calm",            sub: "Relaxed and open" },
  warm:     { color: "#ED93B1", label: "Warm connection", sub: "Closeness and understanding" },
};

const TYPE_TO_MOOD: Record<string, MoodKey> = {
  mediate: "conflict", clarify: "tension", facilitate: "neutral", encourage: "calm",
};

export default function CouplePage() {
  const [introCompleted, setIntroCompleted] = useState(false);
  const [introData, setIntroData] = useState({
    userName: "", partnerName: "", relationship: "", issue: "", theme: "",
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [emotionScores, setEmotionScores] = useState<EmotionScores | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speaker, setSpeaker] = useState<"user" | "partner">("user");
  const [interventionType, setInterventionType] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodKey>("neutral");
  const [showSessions, setShowSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { const s = localStorage.getItem("couple-ai-sessions"); if (s) setSessions(JSON.parse(s)); }, []);
  useEffect(() => { localStorage.setItem("couple-ai-sessions", JSON.stringify(sessions)); }, [sessions]);

  const detectMood = (msgs: Message[]): MoodKey => {
    const recent = msgs.slice(-4).map(m => m.content).join(" ");
    const kw: Record<MoodKey, string[]> = {
      conflict: ["怒","うるさい","嫌い","最悪","なんで","いつも","全然","どうせ","絶対","許せない"],
      tension:  ["悲しい","寂しい","傷","つらい","不安","心配","怖い","わかってくれない","疲れた"],
      warm:     ["ありがとう","嬉しい","好き","愛","大切","幸せ","一緒","ごめん","わかった"],
      calm:     ["そうだね","なるほど","落ち着","確かに","うん","大丈夫","わかる"],
      neutral:  [],
    };
    const scores: Record<MoodKey, number> = { conflict:0, tension:0, warm:0, calm:0, neutral:0 };
    for (const [key, words] of Object.entries(kw) as [MoodKey, string[]][]) {
      for (const word of words) { if (recent.includes(word)) scores[key]++; }
    }
    const top = (Object.entries(scores) as [MoodKey, number][]).sort((a,b) => b[1]-a[1])[0];
    return top[1] > 0 ? top[0] : "neutral";
  };

  const speak = (text: string, emotion: "calm" | "tense" = "calm") => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang==="ja-JP" && (v.name.includes("Google")||v.name.includes("Kyoko")||v.name.includes("Siri")||v.name.includes("Microsoft"))) || voices.find(v => v.lang==="ja-JP");
    const rate = emotion === "tense" ? 1.0 : 0.8;
    const sentences = text.split(/(?<=[。？！\n])/).map(s=>s.trim()).filter(Boolean);
    setIsSpeaking(true);
    sentences.forEach((sentence, i) => {
      const u = new SpeechSynthesisUtterance();
      u.lang="ja-JP"; u.volume=1; u.rate=rate; u.pitch=0.85;
      if (voice) u.voice=voice;
      u.text = sentence.replace(/、/g,"、…");
      if (i === sentences.length - 1) u.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(u);
    });
  };

  const startListening = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    const SR = (window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if (!SR) { alert("このブラウザは音声入力に対応していません"); return; }
    const r = new SR();
    r.lang="ja-JP"; r.continuous=true; r.interimResults=true; r.maxAlternatives=1;
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    r.onstart = () => setListening(true);
    r.onresult = (e: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }
      setInput(finalTranscript + interimTranscript);
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => r.stop(), 20000);
    };
    r.onend = () => { setListening(false); if (silenceTimer) clearTimeout(silenceTimer); };
    r.onerror = () => setListening(false);
    // 音声合成との競合を避けるため少し遅らせて開始
    window.speechSynthesis.cancel();
    setTimeout(() => r.start(), 300);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const newMessages: Message[] = [...messages, { role: speaker, content: input }];
    setMessages(newMessages); setInput("");
    setInterventionType(null); setMood(detectMood(newMessages));
    setLoading(true);
    try {
      const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ messages: newMessages, introData }) });
      const data = await res.json();
      if (data.shouldIntervene && data.reply) {
        setInterventionType(data.interventionType);
        setMessages(p=>[...p,{role:"assistant",content:data.reply}]);
        if (data.interventionType && TYPE_TO_MOOD[data.interventionType]) setMood(TYPE_TO_MOOD[data.interventionType]);
        if (data.nextSpeaker) setSpeaker(data.nextSpeaker as "user" | "partner");
        speak(data.reply, data.interventionType==="mediate"||data.interventionType==="clarify"?"tense":"calm");
      } else {
        setSpeaker(p => p === "user" ? "partner" : "user");
      }
    } catch(e){ console.error(e); } finally { setLoading(false); }
  };

  const endSession = async () => {
    if (!messages.length) return; setLoading(true);
    try {
      const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ messages, isEndSession:true }) });
      const data = await res.json();
      if (data.emotions) setEmotionScores(data.emotions);
      if (data.keywords) setKeywords(data.keywords);
      if (data.issues) setIssues(data.issues);
      const final: Message[] = [...messages, { role:"assistant", content:"【セッションまとめ】\n\n"+data.reply }];
      setMessages(final);
      setSessions(p=>[{id:Date.now(),date:new Date().toLocaleString(),messages:final,emotions:data.emotions,keywords:data.keywords,issues:data.issues},...p]);

      // Supabase に保存（ログイン済みの場合のみ）
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("sessions").insert({
          user_id: session.user.id,
          type: "couple",
          messages: final,
          emotions: data.emotions,
          keywords: data.keywords,
          issues: data.issues,
        });
      }
    } catch(e){ console.error(e); } finally { setLoading(false); }
  };

  const cm = MOODS[mood];
  const ts: Record<string,{icon:string;bg:string;text:string;border:string}> = {
    mediate:   {icon:"🛑",bg:"#FCEBEB",text:"#A32D2D",border:"#F7C1C1"},
    facilitate:{icon:"💬",bg:"#FBEAF0",text:"#993556",border:"#F4C0D1"},
    clarify:   {icon:"🔍",bg:"#FAEEDA",text:"#854F0B",border:"#FAC775"},
    encourage: {icon:"✨",bg:"#EAF3DE",text:"#3B6D11",border:"#C0DD97"},
  };

  const inputStyle = {
    border: "0.5px solid #f0dde6", borderRadius: 14,
    padding: "12px 14px", fontSize: 14, width: "100%",
    fontFamily: "inherit", outline: "none" as const,
  };
  const textareaStyle = {
    border: "0.5px solid #f0dde6", borderRadius: 14,
    padding: "12px 14px", fontSize: 14, resize: "none" as const,
    fontFamily: "inherit", outline: "none" as const, width: "100%",
  };

  // イントロ画面
  if (!introCompleted) {
    return (
      <main style={{ minHeight: "100vh", background: "#FDF6F9", display: "flex", justifyContent: "center", alignItems: "center", padding: 24, fontFamily: "'DM Sans',sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap'); input:focus,textarea:focus{outline:none}`}</style>
        <div style={{ width: "100%", maxWidth: 480, background: "white", borderRadius: 24, padding: 32, border: "0.5px solid #f0dde6", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 4px 24px rgba(212,83,126,.08)" }}>
          <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 24, color: "#3a2030", marginBottom: 4 }}>Couple Counseling</h1>
          <p style={{ fontSize: 13, color: "#b89aab", lineHeight: 1.6, margin: 0 }}>
            最初に、今のお二人について少しだけ教えてください。
          </p>
          <input placeholder="あなたの名前" value={introData.userName}
            onChange={e => setIntroData({...introData, userName: e.target.value})} style={inputStyle} />
          <input placeholder="パートナーの名前" value={introData.partnerName}
            onChange={e => setIntroData({...introData, partnerName: e.target.value})} style={inputStyle} />
          <input placeholder="関係性（恋人・夫婦など）" value={introData.relationship}
            onChange={e => setIntroData({...introData, relationship: e.target.value})} style={inputStyle} />
          <textarea placeholder="今一番困っていること" rows={3} value={introData.issue}
            onChange={e => setIntroData({...introData, issue: e.target.value})} style={textareaStyle} />
          <textarea placeholder="今日話したいテーマ" rows={2} value={introData.theme}
            onChange={e => setIntroData({...introData, theme: e.target.value})} style={textareaStyle} />
          <button onClick={() => setIntroCompleted(true)}
            style={{ marginTop: 8, border: "none", background: "#D4537E", color: "white", padding: "14px 0", borderRadius: 16, fontSize: 14, cursor: "pointer", fontWeight: 500 }}>
            会話を始める
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{minHeight:"100vh",background:"#FDF6F9",display:"flex",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap');
        @keyframes hb{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        @keyframes pl{0%,100%{transform:scale(1);opacity:.15}50%{transform:scale(1.2);opacity:.28}}
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fi{animation:fi .3s ease}
        .hsv{animation:hb 2.8s ease-in-out infinite}
        .hr{animation:pl 2.8s ease-in-out infinite}
        textarea:focus{outline:none}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#f0c0d0;border-radius:4px}
      `}</style>

      {/* 左パネル */}
      <div style={{width:200,background:"white",borderRight:"0.5px solid #f0dde6",display:"flex",flexDirection:"column",alignItems:"center",padding:"28px 16px",gap:18,position:"sticky",top:0,height:"100vh"}}>
        <span style={{fontSize:10,color:"#b89aab",letterSpacing:".1em",textTransform:"uppercase",textAlign:"center"}}>Relationship<br/>atmosphere</span>

        <div style={{position:"relative",width:110,height:110,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div className="hr" style={{position:"absolute",width:110,height:110,borderRadius:"50%",background:cm.color}}/>
          <svg className="hsv" width="72" height="66" viewBox="0 0 72 66" fill="none" style={{position:"relative",zIndex:1,filter:`drop-shadow(0 4px 18px ${cm.color}66)`}}>
            <path d="M36 62S4 42 4 20C4 10 12 3 22 3c6 0 11 3 14 8 3-5 8-8 14-8 10 0 18 7 18 17C68 42 36 62 36 62Z" fill={cm.color}/>
            <path d="M22 14c-3 0-6 2-8 5" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity=".45"/>
          </svg>
        </div>

        <div style={{textAlign:"center"}}>
          <div style={{fontSize:13,fontWeight:500,color:"#3a2030"}}>{cm.label}</div>
          <div style={{fontSize:11,color:"#b89aab",marginTop:2}}>{cm.sub}</div>
        </div>

        <div style={{display:"flex",gap:6}}>
          {(Object.entries(MOODS) as [MoodKey,typeof MOODS[MoodKey]][]).map(([key,m])=>(
            <div key={key} onClick={()=>setMood(key)} title={m.label}
              style={{width:9,height:9,borderRadius:"50%",background:m.color,cursor:"pointer",outline:mood===key?`2px solid ${m.color}`:"none",outlineOffset:2}}/>
          ))}
        </div>

        <div style={{width:"100%",height:"0.5px",background:"#f0dde6"}}/>

        <div style={{width:"100%",display:"flex",flexDirection:"column",gap:10}}>
          {[{i:"A",l:"あなた",bg:"#FBEAF0",c:"#993556"},{i:"P",l:"パートナー",bg:"#E6F1FB",c:"#185FA5"},{i:"AI",l:"Counselor AI",bg:"#EAF3DE",c:"#27500A"}].map(p=>(
            <div key={p.l} style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:p.bg,color:p.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:500,flexShrink:0}}>{p.i}</div>
              <span style={{fontSize:12,color:"#7a6070"}}>{p.l}</span>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#63c76e",marginLeft:"auto"}}/>
            </div>
          ))}
        </div>

        <div style={{width:"100%",height:"0.5px",background:"#f0dde6"}}/>
        <button onClick={()=>setShowSessions(v=>!v)} style={{width:"100%",padding:"7px 0",borderRadius:20,border:"0.5px solid #f0dde6",background:"white",fontSize:11,color:"#b89aab",cursor:"pointer"}}>履歴 {sessions.length>0&&`(${sessions.length})`}</button>
        <button onClick={()=>{setMessages([]);setEmotionScores(null);setKeywords([]);setIssues([]);setSpeaker("user");setMood("neutral");}} style={{width:"100%",padding:"7px 0",borderRadius:20,border:"none",background:cm.color,color:"white",fontSize:11,fontWeight:500,cursor:"pointer"}}>新規セッション</button>
      </div>

      {/* 履歴 */}
      {showSessions&&(
        <div style={{width:220,background:"white",borderRight:"0.5px solid #f0dde6",overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:11,color:"#b89aab",marginBottom:4}}>セッション履歴</div>
          {sessions.length===0&&<p style={{fontSize:12,color:"#d0c0cc"}}>まだ保存がありません</p>}
          {sessions.map(s=>(
            <button key={s.id} onClick={()=>{setMessages(s.messages);if(s.emotions)setEmotionScores(s.emotions);setKeywords(s.keywords||[]);setIssues(s.issues||[]);setShowSessions(false);}}
              style={{textAlign:"left",padding:"10px 12px",borderRadius:12,border:"0.5px solid #f0dde6",background:"white",cursor:"pointer",width:"100%"}}>
              <div style={{fontSize:10,color:"#b89aab"}}>{s.date}</div>
              {s.keywords&&s.keywords.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>{s.keywords.slice(0,3).map((kw,i)=><span key={i} style={{background:"#FBEAF0",color:"#993556",fontSize:10,padding:"2px 8px",borderRadius:20}}>{kw}</span>)}</div>}
              {s.issues&&s.issues.length>0&&<div style={{fontSize:10,color:"#b89aab",marginTop:4}}>⚡ {s.issues[0]}</div>}
            </button>
          ))}
        </div>
      )}

      {/* チャット */}
      <div style={{flex:1,display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"24px"}}>
        <div style={{width:"100%",maxWidth:560,background:"white",borderRadius:24,border:"0.5px solid #f0dde6",display:"flex",flexDirection:"column",height:"calc(100vh - 48px)",boxShadow:"0 2px 24px rgba(212,83,126,.06)"}}>

          <div style={{padding:"18px 24px",borderBottom:"0.5px solid #f0dde6",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontFamily:"'DM Serif Display',serif",fontSize:16,color:"#3a2030"}}>Couple Counseling</span>
            <span style={{fontSize:11,padding:"3px 12px",borderRadius:20,background:speaker==="user"?"#FBEAF0":"#E6F1FB",color:speaker==="user"?"#993556":"#185FA5",fontWeight:500}}>
              {speaker==="user"?"あなたの番":"パートナーの番"}
            </span>
          </div>

          {(emotionScores||keywords.length>0||issues.length>0)&&(
            <div style={{padding:"16px 20px",borderBottom:"0.5px solid #f0dde6",display:"flex",flexDirection:"column",gap:10}}>
              {keywords.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6}}><span style={{fontSize:11,color:"#b89aab",marginRight:4}}>🏷</span>{keywords.map((kw,i)=><span key={i} style={{background:"#FBEAF0",color:"#993556",fontSize:11,padding:"2px 10px",borderRadius:20,border:"0.5px solid #F4C0D1"}}>{kw}</span>)}</div>}
              {issues.length>0&&<div style={{display:"flex",flexDirection:"column",gap:3}}>{issues.map((issue,i)=><div key={i} style={{fontSize:11,color:"#854F0B",background:"#FAEEDA",padding:"3px 10px",borderRadius:8}}>⚡ {issue}</div>)}</div>}
              {emotionScores&&(["user","partner"] as const).map(key=>(
                <div key={key}>
                  <div style={{fontSize:10,color:"#b89aab",marginBottom:4}}>{key==="user"?"あなた":"パートナー"}</div>
                  {(["anger","sadness","anxiety","understanding"] as const).map(id=>{
                    const emojis={anger:"😡",sadness:"😢",anxiety:"😰",understanding:"🤝"};
                    const colors={user:"#D4537E",partner:"#378ADD"};
                    return(
                      <div key={id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                        <span style={{width:60,fontSize:10,color:"#b89aab",flexShrink:0}}>{emojis[id]} {id}</span>
                        <div style={{flex:1,background:"#f5eef2",borderRadius:4,height:6}}>
                          <div style={{width:`${(emotionScores[key][id]/10)*100}%`,background:colors[key],height:6,borderRadius:4,transition:"width .5s"}}/>
                        </div>
                        <span style={{fontSize:10,color:"#b89aab",width:28,textAlign:"right"}}>{emotionScores[key][id]}/10</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
            {messages.length===0&&<div style={{textAlign:"center",color:"#d0c0cc",fontSize:13,marginTop:40}}>まず「あなた」から気持ちを書いてください</div>}
            {messages.map((m,i)=>{
              if(m.role==="assistant"){
                const t=interventionType&&i===messages.length-1&&ts[interventionType]?ts[interventionType]:{icon:"💭",bg:"#F1EFE8",text:"#5F5E5A",border:"#D3D1C7"};
                return(<div key={i} className="fi" style={{display:"flex",justifyContent:"center"}}><div style={{maxWidth:"85%",padding:"10px 16px",borderRadius:14,border:`0.5px solid ${t.border}`,background:t.bg,color:t.text,fontSize:12,fontStyle:"italic",textAlign:"center",lineHeight:1.6}}>{t.icon} {m.content}</div></div>);
              }
              const isUser=m.role==="user";
              return(
                <div key={i} className="fi" style={{display:"flex",flexDirection:isUser?"row-reverse":"row",gap:10,alignItems:"flex-end"}}>
                  <div style={{width:26,height:26,borderRadius:"50%",background:isUser?"#FBEAF0":"#E6F1FB",color:isUser?"#993556":"#185FA5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:500,flexShrink:0}}>{isUser?"A":"P"}</div>
                  <div>
                    <div style={{fontSize:10,color:"#b89aab",marginBottom:3,textAlign:isUser?"right":"left"}}>{isUser?"あなた":"パートナー"}</div>
                    <div style={{maxWidth:260,padding:"10px 14px",borderRadius:16,borderBottomRightRadius:isUser?4:16,borderBottomLeftRadius:isUser?16:4,background:isUser?"#F4C0D1":"#B5D4F4",color:isUser?"#4B1528":"#042C53",fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.content}</div>
                  </div>
                </div>
              );
            })}
            {loading&&<div style={{display:"flex",justifyContent:"center"}}><div style={{padding:"8px 18px",borderRadius:12,background:"#FDF0F5",fontSize:11,color:"#b89aab"}}>AIが判断中…</div></div>}
            <div ref={bottomRef}/>
          </div>

          <div style={{padding:"0 20px 8px"}}>
            <button onClick={endSession} style={{width:"100%",padding:"9px 0",borderRadius:20,border:"0.5px solid #f0dde6",background:"white",fontSize:12,color:"#b89aab",cursor:"pointer"}}>セッション終了してまとめる</button>
          </div>

          <div style={{padding:"0 20px 8px",display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:10,color:"#d0c0cc"}}>手動：</span>
            {(["user","partner"] as const).map(s=>(
              <button key={s} onClick={()=>setSpeaker(s)} style={{padding:"4px 14px",borderRadius:20,border:"none",fontSize:11,fontWeight:500,cursor:"pointer",background:speaker===s?(s==="user"?"#D4537E":"#378ADD"):"#f5eef2",color:speaker===s?"white":"#b89aab",transition:"all .2s"}}>
                {s==="user"?"あなた":"パートナー"}
              </button>
            ))}
          </div>

          <div style={{borderTop:"0.5px solid #f0dde6",padding:"12px 16px",display:"flex",gap:8,alignItems:"flex-end",background:speaker==="user"?"#fff9fb":"#f6f9ff",borderBottomLeftRadius:24,borderBottomRightRadius:24}}>
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
              placeholder={speaker==="user"?"あなたの気持ちを書いてください…":"パートナーの気持ちを書いてください…"}
              rows={2} style={{flex:1,border:`0.5px solid ${speaker==="user"?"#F4C0D1":"#B5D4F4"}`,borderRadius:16,padding:"10px 14px",fontSize:13,fontFamily:"inherit",resize:"none",background:"white",color:"#3a2030",lineHeight:1.5}}/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <button onClick={startListening} title={isSpeaking?"AI発話中（タップで停止）":"音声入力"}
                style={{width:36,height:36,borderRadius:"50%",border:"none",background:listening?"#E24B4A":isSpeaking?"#EF9F27":"#f5eef2",color:listening||isSpeaking?"white":"#b89aab",fontSize:16,cursor:"pointer"}}>
                {isSpeaking?"🔇":"🎤"}
              </button>
              <button onClick={sendMessage} disabled={loading}
                style={{width:36,height:36,borderRadius:"50%",border:"none",background:speaker==="user"?"#D4537E":"#378ADD",color:"white",fontSize:16,cursor:"pointer",opacity:loading?0.5:1}}>↑</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}