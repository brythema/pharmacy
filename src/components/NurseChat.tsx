import { useState, useRef, useEffect, useMemo, FormEvent } from "react";
import { Message, PatientProfile, Drug } from "../types";
import { Send, HeartPulse, User, HelpCircle, AlertTriangle, Plus, Archive, History } from "lucide-react";

interface NurseChatProps {
  profile: PatientProfile | null;
  messages: Message[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  pendingDrugContext: Drug | null;
  onClearPendingDrug: () => void;
  onOpenProfile: () => void;
  tenantConfig?: {
    pharmacyName: string;
    nurseName: string;
    logoUrl: string;
    themeColor: string;
    pharmacyAddress: string;
    whatsappNumber: string;
  };
  currentConversationId: string;
  setCurrentConversationId: (id: string) => void;
}

export default function NurseChat({
  profile,
  messages,
  onSendMessage,
  isLoading,
  pendingDrugContext,
  onClearPendingDrug,
  onOpenProfile,
  tenantConfig,
  currentConversationId,
  setCurrentConversationId,
}: NurseChatProps) {
  const [input, setInput] = useState("");
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const pharmacyName = tenantConfig?.pharmacyName || "Bmedix";
  const nurseName = tenantConfig?.nurseName || "Nurse Sarah";

  const presetInquiries = [
    {
      label: "BP & Decongestants",
      text: "Are pseudoephedrine-based decongestants (like Sudafed) safe if I have High Blood Pressure?",
    },
    {
      label: "Blood Thinners & Pain",
      text: "I take blood thinners (like Warfarin). Is taking Ibuprofen (Advil) safe for muscle aches?",
    },
    {
      label: "Amoxicillin Directions",
      text: "What are the common side effects of Amoxicillin? Should I take it with or without food?",
    },
    {
      label: "Penicillin Allergies",
      text: "I have a severe Penicillin allergy. What safe alternative antibiotics exist for strep throat?",
    },
  ];

  // Derive conversations from messages
  const userConversations = useMemo(() => {
    const map = new Map<string, { id: string; title: string; date: string; lastMessage: string; rawTimestamp: number }>();

    // Seed default first conversation with standard fallback value
    map.set("default", {
      id: "default",
      title: "Primary Consultation",
      date: "Initial Thread",
      lastMessage: "Start of your clinical consult.",
      rawTimestamp: 0,
    });

    messages.forEach((m) => {
      const convoId = m.conversationId || "default";
      if (m.id === "se-welcome") return;

      const existing = map.get(convoId);
      // Determine the timestamp
      const mNum = m.createdAt || (m.id.match(/\d+/) ? parseInt(m.id.match(/\d+/)![0], 10) : Date.now());
      let title = existing?.title || "";
      if (!title || title === "Primary Consultation") {
        if (m.role === "user") {
          title = m.content.substring(0, 24) + (m.content.length > 24 ? "..." : "");
        }
      }

      const dateStr = m.timestamp || new Date(mNum).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const textSummary = m.content.substring(0, 45) + (m.content.length > 45 ? "..." : "");

      // Only overwrite if it's the first message or if it's a user message starting a session
      map.set(convoId, {
        id: convoId,
        title: title || "Consultation Chat",
        date: dateStr,
        lastMessage: textSummary,
        rawTimestamp: Math.max(existing?.rawTimestamp || 0, mNum),
      });
    });

    // Convert values and sort chronologically descending (newest convo first)
    return Array.from(map.values()).sort((a, b) => b.rawTimestamp - a.rawTimestamp);
  }, [messages]);

  // Filter messages based on active conversation
  const visibleMessages = useMemo(() => {
    return messages.filter(
      (m) => m.conversationId === currentConversationId || (!m.conversationId && currentConversationId === "default")
    );
  }, [messages, currentConversationId]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, isLoading]);

  const handleSend = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput("");
  };

  const handlePresetClick = (presetText: string) => {
    if (isLoading) return;
    onSendMessage(presetText);
  };

  const createNewSession = () => {
    const newId = "convo-" + Date.now();
    setCurrentConversationId(newId);
  };

  // Human-readable simple renderer for clinical advice rich text / markdown blocks
  const renderMessageContent = (text: string, isUserMessage: boolean) => {
    const lines = text.split("\n");
    return (
      <div className={`space-y-2 text-sm leading-relaxed ${isUserMessage ? 'text-white' : 'text-slate-800'}`}>
        {lines.map((line, i) => {
          let trimmed = line.trim();

          // Check lists
          if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
            const content = trimmed.substring(2);
            return (
              <li key={i} className={`list-disc list-inside ml-2 ${isUserMessage ? 'text-white/90' : 'text-slate-700'}`}>
                {renderBoldPhrases(content, isUserMessage)}
              </li>
            );
          }

          // Check numbered lists
          if (/^\d+\.\s/.test(trimmed)) {
            const content = trimmed.replace(/^\d+\.\s/, "");
            const num = trimmed.match(/^\d+/)?.toString() || "1";
            return (
              <div key={i} className={`flex gap-2 ml-1 ${isUserMessage ? 'text-white/90' : 'text-slate-700'}`}>
                <span className={`font-mono font-bold ${isUserMessage ? 'text-white' : 'text-blue-600'}`}>{num}.</span>
                <span>{renderBoldPhrases(content, isUserMessage)}</span>
              </div>
            );
          }

          // Check headers
          if (trimmed.startsWith("###")) {
            return (
              <h5 key={i} className={`font-sans font-bold text-sm mt-3 border-l-2 pl-2 ${isUserMessage ? 'text-white border-white/60' : 'text-slate-905 border-blue-500'}`}>
                {trimmed.replace(/^###\s*/, "")}
              </h5>
            );
          }
          if (trimmed.startsWith("##")) {
            return (
              <h4 key={i} className={`font-sans font-bold text-base mt-4 mb-1 ${isUserMessage ? 'text-white' : 'text-blue-700'}`}>
                {trimmed.replace(/^##\s*/, "")}
              </h4>
            );
          }
          if (trimmed.startsWith("#")) {
            return (
              <h3 key={i} className={`font-sans font-black text-lg mt-5 mb-2 ${isUserMessage ? 'text-white' : 'text-blue-800'}`}>
                {trimmed.replace(/^#\s*/, "")}
              </h3>
            );
          }

          // Check simple dividers
          if (trimmed === "---") {
            return <hr key={i} className={isUserMessage ? "border-white/20 my-4" : "border-slate-100 my-4"} />;
          }

          // Plain paragraph
          return <p key={i} className="paragraph min-h-[1px]">{renderBoldPhrases(line, isUserMessage)}</p>;
        })}
      </div>
    );
  };

  // Formatter for markdown-style **bolding** inside lines
  const renderBoldPhrases = (str: string, isUserMessage: boolean) => {
    const regex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      parts.push(
        <strong
          key={match.index}
          className={`font-semibold px-1 py-0.5 rounded border text-xs ${
            isUserMessage
              ? "bg-white/20 border-white/10 text-white font-extrabold"
              : "bg-blue-50 border-blue-105 text-blue-750 font-extrabold"
          }`}
        >
          {match[1]}
        </strong>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }

    return parts.length > 0 ? parts : str;
  };

  return (
    <div id="ai-nurse-console" className="flex h-[calc(100vh-4.1rem)] bg-slate-50 overflow-hidden">
      
      {/* Left Sidebar for Tablet and Desktop */}
      <div className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0">
        <div className="p-4 border-b border-slate-205 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs font-mono text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Archive className="w-4 h-4 text-blue-500" />
            Sessions Archive
          </span>
          <button
            onClick={createNewSession}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-[10px] uppercase font-mono tracking-wider flex items-center gap-1 transition-all border border-blue-100 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/30">
          {userConversations.map((convo) => {
            const isActive = convo.id === currentConversationId;
            return (
              <button
                key={convo.id}
                onClick={() => setCurrentConversationId(convo.id)}
                className={`w-full text-left p-3 rounded-xl transition-all duration-200 cursor-pointer flex flex-col gap-1 border ${
                  isActive
                    ? "bg-blue-600 text-white border-blue-600 shadow-md animate-fade-in"
                    : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200/80 hover:border-slate-300 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className={`text-xs font-bold truncate flex-1 ${isActive ? "text-white" : "text-slate-900"}`}>
                    {convo.title}
                  </span>
                  <span className={`text-[9px] font-mono whitespace-nowrap shrink-0 ${isActive ? "text-blue-100" : "text-slate-400"}`}>
                    {convo.date}
                  </span>
                </div>
                <p className={`text-[10px] truncate w-full ${isActive ? "text-blue-50/80" : "text-slate-500"}`}>
                  {convo.lastMessage}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden relative">
        
        {/* Top Console Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-white border-b border-slate-200 relative z-[45]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-md overflow-hidden">
                {nurseName.split(" ").pop()}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white animate-pulse"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-sans font-bold text-slate-900 text-sm sm:text-base leading-none">
                  {nurseName}, Clinical AI
                </h2>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-mono text-[9px] uppercase font-bold border border-blue-100">
                  Active 24/7
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                Immediate triage, allergen protection, & localized clinical guidance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Mobile History dropdown */}
            <div className="relative md:hidden">
              <button
                type="button"
                onClick={() => setIsMobileHistoryOpen(!isMobileHistoryOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs text-slate-705 border border-slate-200 transition cursor-pointer"
              >
                <History className="w-4 h-4 text-slate-550" />
                <span className="font-bold">History ({userConversations.length})</span>
              </button>

              {isMobileHistoryOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-[100] p-2.5 space-y-1.5 max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100">
                    <span className="text-[10px] font-mono text-slate-450 uppercase font-bold tracking-wider">Archives</span>
                    <button
                      type="button"
                      onClick={() => {
                        createNewSession();
                        setIsMobileHistoryOpen(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] uppercase font-mono tracking-wider font-extrabold flex items-center gap-0.5 border border-blue-150 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> New
                    </button>
                  </div>
                  {userConversations.map((convo) => {
                    const isActive = convo.id === currentConversationId;
                    return (
                      <button
                        type="button"
                        key={convo.id}
                        onClick={() => {
                          setCurrentConversationId(convo.id);
                          setIsMobileHistoryOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition cursor-pointer flex flex-col gap-0.5 border text-xs ${
                          isActive
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-105 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className="font-bold truncate flex-1">{convo.title}</span>
                          <span className="text-[9px] font-mono opacity-80">{convo.date}</span>
                        </div>
                        <p className="text-[10px] opacity-75 truncate w-full">{convo.lastMessage}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Profile / Emergency State Badge */}
            <div>
              {profile ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                  <HeartPulse className="w-4 h-4 text-blue-600 animate-pulse shrink-0" />
                  <span className="truncate max-w-[120px] sm:max-w-none">File: <strong>{profile.name}</strong></span>
                </div>
              ) : (
                <button
                  onClick={onOpenProfile}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-150 rounded-xl text-xs text-red-650 hover:bg-red-100 cursor-pointer transition-all font-semibold"
                >
                  <AlertTriangle className="w-4 h-4 text-red-500 animate-bounce shrink-0" />
                  <span>Guest Session</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Drug Context Banner */}
        {pendingDrugContext && (
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-2.5 flex items-center justify-between text-xs text-blue-900 font-medium z-10">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-blue-100 border border-blue-200">{pendingDrugContext.image}</span>
              <p>
                Inquiring about <strong>{pendingDrugContext.name}</strong> ({pendingDrugContext.ingredients})
              </p>
            </div>
            <button
              onClick={onClearPendingDrug}
              className="text-[10px] text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded bg-white border border-slate-200 transition cursor-pointer shadow-sm font-semibold"
            >
              Clear Context
            </button>
          </div>
        )}

        {/* Messages Stream container */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          
          {/* Clinician Onboarding Box (shown only if no visible messages in the active thread) */}
          {visibleMessages.length === 0 && (
            <div className="max-w-2xl mx-auto p-6 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 text-blue-600">
                  <HeartPulse className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="font-sans font-black text-slate-900 text-base">
                  Welcome to {pharmacyName} Clinic
                </h3>
              </div>
              
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                I am {nurseName}. I exist 24/7 to answer your pharmaceutical concerns, doublecheck product safety, check allergy guidelines, and screen your cart items.
              </p>

              <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex gap-2 text-xs text-red-700 leading-relaxed font-semibold">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                <div>
                  <strong className="text-red-800">Clinical Safety Warning:</strong>
                  <p className="mt-0.5 text-red-650 text-xs">
                    I provide informative guidance as an AI Nurse assistant. In the event of a severe allergic reaction (anaphylaxis), chest tightness, difficulty breathing, or any acute emergency, please dial <strong>911</strong> or visit the nearest emergency facility immediately.
                  </p>
                </div>
              </div>

              {profile ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-800">Current active risk parameters:</p>
                    <p className="text-[11px] mt-0.5">
                      Allergies: <span className="text-red-600 font-semibold">{profile.allergies || "None"}</span> • Conditions: <span className="text-slate-800 font-semibold">{profile.chronicConditions || "None"}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] uppercase font-mono tracking-wider font-bold text-slate-700 transition shadow-sm whitespace-nowrap cursor-pointer"
                  >
                    Edit profile
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-amber-900">Personal safety profile deactivated</p>
                    <p className="text-[11px] mt-0.5 font-medium leading-relaxed">Please add your personal clinical factors so that I can automatically catch dangerous drug collisions.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 border border-amber-600 rounded-lg text-[10px] uppercase font-mono tracking-wider font-extrabold text-white transition whitespace-nowrap shadow-sm cursor-pointer"
                  >
                    Configure profile
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Render Active messages list */}
          {visibleMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 max-w-3xl ${
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  msg.role === "user"
                    ? "bg-slate-200 border-slate-300 text-slate-700"
                    : "bg-blue-50 border-blue-100 text-blue-600"
                }`}
              >
                {msg.role === "user" ? <User className="w-4 h-4" /> : <HeartPulse className="w-4 h-4" />}
              </div>

              {/* Bubble */}
              <div
                className={`p-4 rounded-2xl shadow-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 rounded-tr-none text-white"
                    : "bg-white border border-slate-200 rounded-tl-none text-slate-800"
                }`}
              >
                <div className={`text-[10px] font-mono mb-1 text-right ${msg.role === "user" ? "text-blue-200/95" : "text-slate-400"}`}>
                  {msg.timestamp}
                </div>
                <div>
                  {msg.role === "user" ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    renderMessageContent(msg.content, false)
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator spinner and bubbles */}
          {isLoading && (
            <div className="flex gap-4 max-w-2xl mr-auto items-start">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <HeartPulse className="w-4 h-4 animate-spin text-blue-600" />
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none flex flex-col gap-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-bold font-mono tracking-wide uppercase">
                    {nurseName} is formulating guidelines...
                  </span>
                  <div className="flex gap-1 items-center px-1.5 py-1 bg-slate-100 rounded-full">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center mt-0.5">
                  <span className="px-1.5 py-0.5 rounded bg-blue-50/70 border border-blue-100 text-[9px] font-mono text-blue-600">Scanning Allergies</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-[9px] font-mono text-slate-500 animate-pulse">Checking Contraindications</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Preset helper suggestions */}
        {visibleMessages.length < 5 && profile?.isConfirmed === true && (
          <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200/80 relative z-10 font-medium">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 font-semibold">
              <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
              <span>Frequent clinical queries:</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide no-scrollbar">
              {presetInquiries.map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  disabled={isLoading}
                  onClick={() => handlePresetClick(preset.text)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 font-semibold hover:border-blue-500 hover:text-blue-600 transition whitespace-nowrap cursor-pointer text-left shadow-sm hover:shadow"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Form Bar */}
        <div className="p-4 bg-white border-t border-slate-200 relative z-20">
          {profile && profile.isConfirmed !== true && (
            <div className="max-w-4xl mx-auto mb-3 p-3 bg-amber-50 border border-amber-150 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
              <div className="text-left text-[11px] leading-relaxed text-amber-800 font-semibold">
                <span className="font-bold text-amber-900 mr-1">Triage Review Pending:</span> This medical profile is currently awaiting pharmacist confirmation. Safety parameters are active, and you can chat with {nurseName} or reply to any clinical messages.
              </div>
            </div>
          )}
          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-2">
            <input
              type="text"
              required
              disabled={isLoading}
              placeholder={
                pendingDrugContext
                  ? `Ask ${nurseName} about ${pendingDrugContext.name}...`
                  : "Ask anything about drugs, dosages, safety limits, or symptoms..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-sm text-slate-800 placeholder-slate-400 transition-all shadow-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-sm whitespace-nowrap"
            >
              <span>Ask Nurse</span>
              <Send className="w-4 h-4 text-white stroke-[2.5]" />
            </button>
          </form>
          <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
            If you are experiencing severe clinical symptoms, please contact emergency dispatch immediately. Always consult doctors for diagnosing conditions.
          </p>
        </div>

      </div>

    </div>
  );
}
