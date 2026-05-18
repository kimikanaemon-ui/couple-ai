"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ParentChildPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#FDF9F4" }} />}>
      <ParentChildPageInner />
    </Suspense>
  );
}

function ParentChildPageInner() {
  const searchParams = useSearchParams();

  const preTheme = searchParams.get("theme") || "";
  const preGoal = searchParams.get("goal") || "";
  const preConflict = searchParams.get("conflict") || "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [emotionScores, setEmotionScores] = useState<EmotionScores | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaker, setSpeaker] = useState<"parent" | "child">("parent");
  const [interventionType, setInterventionType] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodKey>("neutral");
  const [showSessions, setShowSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
function ParentChildPageInner() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [emotionScores, setEmotionScores] = useState<EmotionScores | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaker, setSpeaker] = useState<"parent" | "child">("parent");
  const [interventionType, setInterventionType] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodKey>("neutral");
  const [showSessions, setShowSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { const s = localStorage.getItem("family-ai-sessions"); if (s) setSessions(JSON.parse(s)); }, []);
  useEffect(() => { localStorage.setItem("family-ai-sessions", JSON.stringify(sessions)); }, [sessions]);

  const detectMood = (msgs: Message[]): MoodKey => {
    const recent = msgs.slice(-4).map(m => m.content).join(" ");
    const kw: Record<MoodKey, string[]> = {
      conflict: ["怒","うるさい","嫌い","最悪","なんで","いつも","全然","どうせ","うざい","関係ない"],
      tension:  ["悲しい","寂しい","傷","つらい","不安","心配","怖い","わかってくれない","疲れた","嫌"],
      warm:     ["ありがとう","嬉しい","好き","大切","幸せ","一緒","ごめん","わかった","そうか"],
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
    text.split(/(?<=[。？！\n])/).map(s=>s.trim()).filter(Boolean).forEach(sentence => {
      const u = new SpeechSynthesisUtterance();
      u.lang="ja-JP"; u.volume=1; u.rate=rate; u.pitch=0.85;
      if (voice) u.voice=voice;
      u.text = sentence.replace(/、/g,"、…");
      window.speechSynthesis.speak(u);
    });
  };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if (!SR) { alert("このブラウザは音声入力に対応していません"); return; }
    const r = new SR(); r.lang="ja-JP";
    r.onstart=()=>setListening(true); r.onend=()=>setListening(false);
    r.onresult=(e:any)=>{ const t=e.results[0][0].transcript; setInput(p=>p?p+" "+t:t); };
    r.start();
  };

  const sendMessage = async () => {
    if (!input.trim()||loading) return;
    const newMessages: Message[] = [...messages, { role: speaker, content: input }];
    setMessages(newMessages); setInput("");
    setSpeaker(p=>p==="parent"?"child":"parent");
    setInterventionType(null); setMood(detectMood(newMessages));
    setLoading(true);
    try {
      const res = await fetch("/api/family-chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ messages: newMessages }) });
      const data = await res.json();
      if (data.shouldIntervene && data.reply) {
        setInterventionType(data.interventionType);
        setMessages(p=>[...p,{role:"assistant",content:data.reply}]);
        if (data.interventionType && TYPE_TO_MOOD[data.interventionType]) setMood(TYPE_TO_MOOD[data.interventionType]);
        speak(data.reply, data.interventionType==="mediate"||data.interventionType==="clarify"?"tense":"calm");
      }
    } catch(e){ console.error(e); } finally { setLoading(false); }
  };

  const endSession = async () => {
    if (!messages.length) return; setLoading(true);
    try {
      const res = await fetch("/api/family-chat", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ messages, isEndSession:true }) });
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
          type: "family",
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
    facilitate:{icon:"💬",bg:"#FDE8C8",text:"#854F0B",border:"#FAC775"},
    clarify:   {icon:"🔍",bg:"#FAEEDA",text:"#854F0B",border:"#FAC775"},
    encourage: {icon:"✨",bg:"#EAF3DE",text:"#3B6D11",border:"#C0DD97"},
  };

  return (
    <main style={{minHeight:"100vh",background:"#FDF9F4",display:"flex",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap');
        @keyframes hb{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        @keyframes pl{0%,100%{transform:scale(1);opacity:.15}50%{transform:scale(1.2);opacity:.28}}
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fi{animation:fi .3s ease}
        .tsv{animation:hb 2.8s ease-in-out infinite}
        .tr{animation:pl 2.8s ease-in-out infinite}
        textarea:focus{outline:none}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#f0d9c0;border-radius:4px}
      `}</style>

      {/* 左パネル */}
      <div style={{width:200,background:"white",borderRight:"0.5px solid #f0e4d0",display:"flex",flexDirection:"column",alignItems:"center",padding:"28px 16px",gap:18,position:"sticky",top:0,height:"100vh"}}>
        <span style={{fontSize:10,color:"#c4a882",letterSpacing:".1em",textTransform:"uppercase",textAlign:"center"}}>Family<br/>atmosphere</span>

        <div style={{position:"relative",width:110,height:110,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div className="tr" style={{position:"absolute",width:110,height:110,borderRadius:"50%",background:cm.color}}/>
          <div className="tsv" style={{position:"relative",zIndex:1,fontSize:56,filter:`drop-shadow(0 4px 18px ${cm.color}66)`,lineHeight:1}}>🌳</div>
        </div>

        <div style={{textAlign:"center"}}>
          <div style={{fontSize:13,fontWeight:500,color:"#3a2a1a"}}>{cm.label}</div>
          <div style={{fontSize:11,color:"#c4a882",marginTop:2}}>{cm.sub}</div>
        </div>

        <div style={{display:"flex",gap:6}}>
          {(Object.entries(MOODS) as [MoodKey,typeof MOODS[MoodKey]][]).map(([key,m])=>(
            <div key={key} onClick={()=>setMood(key)} title={m.label}
              style={{width:9,height:9,borderRadius:"50%",background:m.color,cursor:"pointer",outline:mood===key?`2px solid ${m.color}`:"none",outlineOffset:2}}/>
          ))}
        </div>

        <div style={{width:"100%",height:"0.5px",background:"#f0e4d0"}}/>

        <div style={{width:"100%",display:"flex",flexDirection:"column",gap:10}}>
          {[{i:"親",l:"保護者",bg:"#FDE8C8",c:"#854F0B"},{i:"子",l:"お子さん",bg:"#D4EAF7",c:"#0C447C"},{i:"AI",l:"Counselor AI",bg:"#EAF3DE",c:"#27500A"}].map(p=>(
            <div key={p.l} style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:p.bg,color:p.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:500,flexShrink:0}}>{p.i}</div>
              <span style={{fontSize:12,color:"#8a7060"}}>{p.l}</span>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#63c76e",marginLeft:"auto"}}/>
            </div>
          ))}
        </div>

        <div style={{width:"100%",height:"0.5px",background:"#f0e4d0"}}/>
        <button onClick={()=>setShowSessions(v=>!v)} style={{width:"100%",padding:"7px 0",borderRadius:20,border:"0.5px solid #f0e4d0",background:"white",fontSize:11,color:"#c4a882",cursor:"pointer"}}>履歴 {sessions.length>0&&`(${sessions.length})`}</button>
        <button onClick={()=>{setMessages([]);setEmotionScores(null);setKeywords([]);setIssues([]);setSpeaker("parent");setMood("neutral");}} style={{width:"100%",padding:"7px 0",borderRadius:20,border:"none",background:cm.color,color:"white",fontSize:11,fontWeight:500,cursor:"pointer"}}>新規セッション</button>
      </div>

      {/* 履歴 */}
      {showSessions&&(
        <div style={{width:220,background:"white",borderRight:"0.5px solid #f0e4d0",overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:11,color:"#c4a882",marginBottom:4}}>セッション履歴</div>
          {sessions.length===0&&<p style={{fontSize:12,color:"#d8cfc4"}}>まだ保存がありません</p>}
          {sessions.map(s=>(
            <button key={s.id} onClick={()=>{setMessages(s.messages);if(s.emotions)setEmotionScores(s.emotions);setKeywords(s.keywords||[]);setIssues(s.issues||[]);setShowSessions(false);}}
              style={{textAlign:"left",padding:"10px 12px",borderRadius:12,border:"0.5px solid #f0e4d0",background:"white",cursor:"pointer",width:"100%"}}>
              <div style={{fontSize:10,color:"#c4a882"}}>{s.date}</div>
              {s.keywords&&s.keywords.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>{s.keywords.slice(0,3).map((kw,i)=><span key={i} style={{background:"#FDE8C8",color:"#854F0B",fontSize:10,padding:"2px 8px",borderRadius:20}}>{kw}</span>)}</div>}
              {s.issues&&s.issues.length>0&&<div style={{fontSize:10,color:"#c4a882",marginTop:4}}>⚡ {s.issues[0]}</div>}
            </button>
          ))}
        </div>
      )}

      {/* チャット */}
      <div style={{flex:1,display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"24px"}}>
        <div style={{width:"100%",maxWidth:560,background:"white",borderRadius:24,border:"0.5px solid #f0e4d0",display:"flex",flexDirection:"column",height:"calc(100vh - 48px)",boxShadow:"0 2px 24px rgba(224,123,42,.06)"}}>

          <div
  style={{
    padding: "18px 24px",
    borderBottom: "0.5px solid #f0e4d0",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  }}
>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <span
      style={{
        fontFamily: "'DM Serif Display',serif",
        fontSize: 16,
        color: "#3a2a1a",
      }}
    >
      Family Counseling
    </span>

    <span
      style={{
        fontSize: 11,
        padding: "3px 12px",
        borderRadius: 20,
        background: speaker === "parent" ? "#FDE8C8" : "#D4EAF7",
        color: speaker === "parent" ? "#854F0B" : "#0C447C",
        fontWeight: 500,
      }}
    >
      {speaker === "parent" ? "保護者の番" : "お子さんの番"}
    </span>
  </div>

  {preGoal && (
    <div
      style={{
        fontSize: 11,
        color: "#5F5E5A",
        background: "#FDE8C8",
        borderRadius: 10,
        padding: "6px 12px",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span>🎯</span>
      <span>{preGoal}</span>
    </div>
  )}

  {preTheme && (
    <div
      style={{
        fontSize: 11,
        color: "#5F5E5A",
        background: "#FAEEDA",
        borderRadius: 10,
        padding: "6px 12px",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span>💭</span>
      <span>{preTheme}</span>
    </div>
  )}

  {preConflict && (
    <div
      style={{
        fontSize: 11,
        color: "#5F5E5A",
        background: "#FCEBEB",
        borderRadius: 10,
        padding: "6px 12px",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span>⚡</span>
      <span>{preConflict}</span>
    </div>
  )}
</div>
              <div style={{fontSize:11,color:"#5F5E5A",background:"#FDE8C8",borderRadius:10,padding:"6px 12px",display:"flex",alignItems:"center",gap:6}}>
                <span>🎯</span><span>{preGoal}</span>
              </div>
            )}
          </div>

          {(emotionScores||keywords.length>0||issues.length>0)&&(
            <div style={{padding:"16px 20px",borderBottom:"0.5px solid #f0e4d0",display:"flex",flexDirection:"column",gap:10}}>
              {keywords.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6}}><span style={{fontSize:11,color:"#c4a882",marginRight:4}}>🏷</span>{keywords.map((kw,i)=><span key={i} style={{background:"#FDE8C8",color:"#854F0B",fontSize:11,padding:"2px 10px",borderRadius:20,border:"0.5px solid #FAC775"}}>{kw}</span>)}</div>}
              {issues.length>0&&<div style={{display:"flex",flexDirection:"column",gap:3}}>{issues.map((issue,i)=><div key={i} style={{fontSize:11,color:"#854F0B",background:"#FAEEDA",padding:"3px 10px",borderRadius:8}}>⚡ {issue}</div>)}</div>}
              {emotionScores&&(["parent","child"] as const).map(key=>(
                <div key={key}>
                  <div style={{fontSize:10,color:"#c4a882",marginBottom:4}}>{key==="parent"?"保護者":"お子さん"}</div>
                  {(["anger","sadness","anxiety","understanding"] as const).map(id=>{
                    const emojis={anger:"😡",sadness:"😢",anxiety:"😰",understanding:"🤝"};
                    const colors={parent:"#E07B2A",child:"#378ADD"};
                    return(
                      <div key={id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                        <span style={{width:60,fontSize:10,color:"#c4a882",flexShrink:0}}>{emojis[id]} {id}</span>
                        <div style={{flex:1,background:"#f5ede0",borderRadius:4,height:6}}>
                          <div style={{width:`${(emotionScores[key][id]/10)*100}%`,background:colors[key],height:6,borderRadius:4,transition:"width .5s"}}/>
                        </div>
                        <span style={{fontSize:10,color:"#c4a882",width:28,textAlign:"right"}}>{emotionScores[key][id]}/10</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
            {messages.length===0&&<div style={{textAlign:"center",color:"#d8cfc4",fontSize:13,marginTop:40}}>まず「保護者」から気持ちを書いてください</div>}
            {messages.map((m,i)=>{
              if(m.role==="assistant"){
                const t=interventionType&&i===messages.length-1&&ts[interventionType]?ts[interventionType]:{icon:"💭",bg:"#F1EFE8",text:"#5F5E5A",border:"#D3D1C7"};
                return(<div key={i} className="fi" style={{display:"flex",justifyContent:"center"}}><div style={{maxWidth:"85%",padding:"10px 16px",borderRadius:14,border:`0.5px solid ${t.border}`,background:t.bg,color:t.text,fontSize:12,fontStyle:"italic",textAlign:"center",lineHeight:1.6}}>{t.icon} {m.content}</div></div>);
              }
              const isParent=m.role==="parent";
              return(
                <div key={i} className="fi" style={{display:"flex",flexDirection:isParent?"row":"row-reverse",gap:10,alignItems:"flex-end"}}>
                  <div style={{width:26,height:26,borderRadius:"50%",background:isParent?"#FDE8C8":"#D4EAF7",color:isParent?"#854F0B":"#0C447C",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:500,flexShrink:0}}>{isParent?"親":"子"}</div>
                  <div>
                    <div style={{fontSize:10,color:"#c4a882",marginBottom:3,textAlign:isParent?"left":"right"}}>{isParent?"保護者":"お子さん"}</div>
                    <div style={{maxWidth:260,padding:"10px 14px",borderRadius:16,borderBottomLeftRadius:isParent?4:16,borderBottomRightRadius:isParent?16:4,background:isParent?"#FDE8C8":"#D4EAF7",color:isParent?"#5C3205":"#063450",fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.content}</div>
                  </div>
                </div>
              );
            })}
            {loading&&<div style={{display:"flex",justifyContent:"center"}}><div style={{padding:"8px 18px",borderRadius:12,background:"#FDF0E0",fontSize:11,color:"#c4a882"}}>AIが判断中…</div></div>}
            <div ref={bottomRef}/>
          </div>

          <div style={{padding:"0 20px 8px"}}>
            <button onClick={endSession} style={{width:"100%",padding:"9px 0",borderRadius:20,border:"0.5px solid #f0e4d0",background:"white",fontSize:12,color:"#c4a882",cursor:"pointer"}}>セッション終了してまとめる</button>
          </div>

          <div style={{padding:"0 20px 8px",display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:10,color:"#d8cfc4"}}>手動：</span>
            {(["parent","child"] as const).map(s=>(
              <button key={s} onClick={()=>setSpeaker(s)} style={{padding:"4px 14px",borderRadius:20,border:"none",fontSize:11,fontWeight:500,cursor:"pointer",background:speaker===s?(s==="parent"?"#E07B2A":"#378ADD"):"#f5ede0",color:speaker===s?"white":"#c4a882",transition:"all .2s"}}>
                {s==="parent"?"保護者":"お子さん"}
              </button>
            ))}
          </div>

          <div style={{borderTop:"0.5px solid #f0e4d0",padding:"12px 16px",display:"flex",gap:8,alignItems:"flex-end",background:speaker==="parent"?"#FFFBF5":"#F4FAFF",borderBottomLeftRadius:24,borderBottomRightRadius:24}}>
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
              placeholder={speaker==="parent"?"保護者の気持ちを書いてください…":"お子さんの気持ちを書いてください…"}
              rows={2} style={{flex:1,border:`0.5px solid ${speaker==="parent"?"#FAC775":"#B5D4F4"}`,borderRadius:16,padding:"10px 14px",fontSize:13,fontFamily:"inherit",resize:"none",background:"white",color:"#3a2a1a",lineHeight:1.5}}/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <button onClick={startListening} style={{width:36,height:36,borderRadius:"50%",border:"none",background:listening?"#E24B4A":"#f5ede0",color:listening?"white":"#c4a882",fontSize:16,cursor:"pointer"}}>🎤</button>
              <button onClick={sendMessage} disabled={loading} style={{width:36,height:36,borderRadius:"50%",border:"none",background:speaker==="parent"?"#E07B2A":"#378ADD",color:"white",fontSize:16,cursor:"pointer",opacity:loading?0.5:1}}>↑</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}