import { useState, useRef, useEffect, FormEvent } from "react";
import { Message, PatientProfile, Drug } from "../types";
import { Send, HeartPulse, User, Sparkles, HelpCircle, AlertTriangle, RefreshCw, Layers } from "lucide-react";

interface NurseChatProps {
  profile: PatientProfile | null;
  messages: Message[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  pendingDrugContext: Drug | null;
  onClearPendingDrug: () => void;
  onOpenProfile: () => void;
}

export default function NurseChat({
  profile,
  messages,
  onSendMessage,
  isLoading,
  pendingDrugContext,
  onClearPendingDrug,
  onOpenProfile,
}: NurseChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
    <div id="ai-nurse-console" className="flex flex-col h-[calc(100vh-4.1rem)] bg-slate-50">
      
      {/* Top Console Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-md">
              Sarah
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white animate-pulse"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-sans font-bold text-slate-900 text-sm sm:text-base leading-none">
                Nurse Sarah, Clinical AI
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

        {/* Personalized State Badge */}
        <div>
          {profile ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
              <HeartPulse className="w-4 h-4 text-blue-600 animate-pulse" />
              <span>Medical File Enabled • <strong>{profile.name}</strong></span>
            </div>
          ) : (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-150 rounded-xl text-xs text-red-650 hover:bg-red-100 cursor-pointer transition-all"
            >
              <AlertTriangle className="w-4 h-4 text-red-500 animate-bounce" />
              <span>Guest Session • Enable Custom Safety checks</span>
            </button>
          )}
        </div>
      </div>

      {/* Drug Context Banner */}
      {pendingDrugContext && (
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-2.5 flex items-center justify-between text-xs text-blue-900 font-medium">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-blue-100 border border-blue-200">{pendingDrugContext.image}</span>
            <p className>
              Inquiring about <strong>{pendingDrugContext.name}</strong> ({pendingDrugContext.ingredients})
            </p>
          </div>
          <button
            onClick={onClearPendingDrug}
            className="text-[10px] text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded bg-white border border-slate-200 transition cursor-pointer shadow-sm"
          >
            Clear Context
          </button>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        
        {/* Clinician Onboarding Box */}
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto p-6 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 text-blue-600">
                <HeartPulse className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="font-sans font-black text-slate-905 text-base">
                Welcome to H-Medix Clinic
              </h3>
            </div>
            
            <p className="text-sm text-slate-600 leading-relaxed">
              I am Nurse Sarah. I exist 24/7 to answer your pharmaceutical concerns, doublecheck product safety, check allergy guidelines, and screen your cart items.
            </p>

            <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex gap-2 text-xs text-red-700 leading-relaxed font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <div>
                <strong className="text-red-850">Clinical Safety Warning:</strong>
                <p className="mt-0.5 text-red-655 text-xs">
                  I provide informative guidance as an AI Nurse assistant. In the event of a severe allergic reaction (anaphylaxis), chest tightness, difficulty breathing, or any acute emergency, please dial <strong>911</strong> or visit the nearest emergency facility immediately.
                </p>
              </div>
            </div>

            {profile ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-805">Current active risk parameters:</p>
                  <p className="text-[11px] mt-0.5">
                    Allergies: <span className="text-red-600 font-semibold">{profile.allergies || "None"}</span> • Conditions: <span className="text-slate-800 font-semibold">{profile.chronicConditions || "None"}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] uppercase font-mono tracking-wider font-bold text-slate-700 transition-all cursor-pointer shadow-sm"
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
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 border border-amber-600 rounded-lg text-[10px] uppercase font-mono tracking-wider font-extrabold text-white transition-all cursor-pointer whitespace-nowrap shadow-sm"
                >
                  Configure profile
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Log Rows */}
        {messages.map((msg) => (
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
              <div className={`text-[10px] font-mono mb-1 text-right ${msg.role === "user" ? "text-blue-200/90" : "text-slate-400"}`}>
                {msg.timestamp}
              </div>
              <div>
                {msg.role === "user" ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  renderMessageContent(msg.content, false)
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loader Status row */}
        {isLoading && (
          <div className="flex gap-4 max-w-2xl mr-auto">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-105 text-blue-600 flex items-center justify-center shrink-0 animate-spin">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none flex flex-col gap-1.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping"></span>
                <span className="text-xs text-blue-650 font-bold font-mono tracking-wide uppercase">
                  Sarah is writing clinical guidelines...
                </span>
              </div>
              <div className="flex gap-1.5 items-center mt-1">
                <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-500 font-mono text-[9px]">Scanning allergies</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-500 font-mono text-[9px]">Verifying contraindications</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset helper suggestions */}
      {messages.length < 6 && (
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200/80">
          <div className="flex items-center gap-1.5 text-xs text-slate-550 mb-2 font-medium">
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
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-655 font-bold hover:border-blue-500 hover:text-blue-605 transition whitespace-nowrap cursor-pointer text-left shadow-sm hover:shadow"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form Bar */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            required
            disabled={isLoading}
            placeholder={
              pendingDrugContext
                ? `Ask Nurse Sarah about ${pendingDrugContext.name}...`
                : "Ask anything about drugs, dosages, safety limits, or symptoms..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-505 focus:outline-none text-sm text-slate-800 placeholder-slate-400 transition-all shadow-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            <span>Ask Nurse</span>
            <Send className="w-4 h-4 text-white stroke-[2.5]" />
          </button>
        </form>
        <p className="text-[10px] text-center text-slate-450 mt-2 font-medium">
          If you are experiencing severe clinical symptoms, please contact emergency dispatch immediately. Always consult doctors for diagnosing conditions.
        </p>
      </div>

    </div>
  );
}
