import { useState, useEffect, useRef, useMemo, FormEvent } from "react";
import { db } from "../firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  increment,
  writeBatch
} from "firebase/firestore";
import { 
  Send, 
  MessageSquare, 
  Plus, 
  Search, 
  Check, 
  CheckCheck, 
  ChevronRight, 
  Calendar, 
  Inbox, 
  Clock, 
  User, 
  Filter, 
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { PatientProfile } from "../types";

interface SupportMessagingProps {
  user: any;
  profile: PatientProfile | null;
  activePharmacyId: string | null;
  tenantConfig?: {
    pharmacyName: string;
    themeColor?: string;
  };
}

interface SupportRoom {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  topic: string;
  status: "open" | "closed";
  createdAt: number;
  lastMessageText: string;
  lastMessageAt: number;
  userUnreadCount: number;
  adminUnreadCount: number;
  pharmacyId: string;
}

interface SupportMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: "patient" | "admin";
  content: string;
  createdAt: number;
  isRead: boolean;
  readAt?: number;
}

const TOPICS = [
  "Prescription Verification Help",
  "Order Status & Shipping Delay",
  "Payment & Billing Discrepancy",
  "Medicine Availability Query",
  "Adverse Effect or Safety Inquiry",
  "General Administrative Support"
];

export default function SupportMessaging({
  user,
  profile,
  activePharmacyId,
  tenantConfig
}: SupportMessagingProps) {
  const [rooms, setRooms] = useState<SupportRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomTopic, setNewRoomTopic] = useState(TOPICS[0]);
  const [newRoomFirstMessage, setNewRoomFirstMessage] = useState("");
  const [roomFilter, setRoomFilter] = useState<"all" | "open" | "closed" | "unread">("all");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pharmacyName = tenantConfig?.pharmacyName || "Bmedix Support";
  const pharmacyId = activePharmacyId || "default";

  // 1. Sync Patient's Support Rooms
  useEffect(() => {
    if (!user) return;

    const roomsRef = collection(db, "support_rooms");
    const q = query(
      roomsRef, 
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: SupportRoom[] = [];
      snapshot.forEach((docSnap) => {
        const rData = docSnap.data();
        if (rData && rData.pharmacyId === pharmacyId) {
          loaded.push({ id: docSnap.id, ...rData } as SupportRoom);
        }
      });
      // Sort descending by lastMessageAt client-side
      loaded.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
      setRooms(loaded);
      
      // Auto-select first room if none is selected
      if (loaded.length > 0 && !selectedRoomId) {
        setSelectedRoomId(loaded[0].id);
      }
    }, (err) => {
      console.error("Error subscribing to support rooms: ", err);
    });

    return () => unsubscribe();
  }, [user, pharmacyId]);

  // 2. Sync Selected Room's Messages
  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      return;
    }

    const msgsRef = collection(db, "support_rooms", selectedRoomId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: SupportMessage[] = [];
      snapshot.forEach((docSnap) => {
        loaded.push({ id: docSnap.id, ...docSnap.data() } as SupportMessage);
      });
      setMessages(loaded);

      // 3. Mark messages as READ for patient
      const unreadFromAdmin = loaded.filter(m => m.senderRole === "admin" && !m.isRead);
      if (unreadFromAdmin.length > 0) {
        const batch = writeBatch(db);
        unreadFromAdmin.forEach(m => {
          const mDocRef = doc(db, "support_rooms", selectedRoomId, "messages", m.id);
          batch.update(mDocRef, { isRead: true, readAt: Date.now() });
        });
        
        // Also update room's userUnreadCount down to 0
        const roomDocRef = doc(db, "support_rooms", selectedRoomId);
        batch.update(roomDocRef, { userUnreadCount: 0 });
        
        batch.commit().catch(e => console.error("Error clearing user unread count: ", e));
      }

    }, (err) => {
      console.error("Error syncing room messages: ", err);
    });

    return () => unsubscribe();
  }, [selectedRoomId]);

  // Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create New Room
  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !newRoomFirstMessage.trim()) return;

    const roomId = "support-" + Date.now();
    const msgId = "msg-" + Date.now();
    const ts = Date.now();

    const uName = profile?.name || user.displayName || user.email || "Support Guest";
    const uEmail = user.email || "";

    const roomData: SupportRoom = {
      id: roomId,
      userId: user.uid,
      userName: uName,
      userEmail: uEmail,
      topic: newRoomTopic,
      status: "open",
      createdAt: ts,
      lastMessageText: newRoomFirstMessage,
      lastMessageAt: ts,
      userUnreadCount: 0,
      adminUnreadCount: 1,
      pharmacyId: pharmacyId
    };

    const firstMsg: SupportMessage = {
      id: msgId,
      senderId: user.uid,
      senderName: uName,
      senderRole: "patient",
      content: newRoomFirstMessage,
      createdAt: ts,
      isRead: false
    };

    try {
      // 1. Create Room document
      await setDoc(doc(db, "support_rooms", roomId), roomData);
      // 2. Create first Message document
      await setDoc(doc(db, "support_rooms", roomId, "messages", msgId), firstMsg);

      setNewRoomFirstMessage("");
      setIsCreatingRoom(false);
      setSelectedRoomId(roomId);
    } catch (err) {
      console.error("Failed to create support room: ", err);
      alert("Failed to reach core support service. Registering error logs.");
    }
  };

  // Send Message in Active Room
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId || !replyText.trim() || !user) return;

    const msgId = "msg-" + Date.now();
    const ts = Date.now();
    const text = replyText.trim();
    const uName = profile?.name || user.displayName || user.email || "Support Guest";

    const msg: SupportMessage = {
      id: msgId,
      senderId: user.uid,
      senderName: uName,
      senderRole: "patient",
      content: text,
      createdAt: ts,
      isRead: false
    };

    setReplyText("");

    try {
      // 1. Write the message
      await setDoc(doc(db, "support_rooms", selectedRoomId, "messages", msgId), msg);
      // 2. Update room parameters
      await updateDoc(doc(db, "support_rooms", selectedRoomId), {
        lastMessageText: text,
        lastMessageAt: ts,
        adminUnreadCount: increment(1)
      });
    } catch (err) {
      console.error("Failed to send support message: ", err);
      alert("Message dispatch failed. Reverting state.");
    }
  };

  // Close Active Room
  const handleCloseRoom = async (roomId: string) => {
    try {
      await updateDoc(doc(db, "support_rooms", roomId), {
        status: "closed"
      });
    } catch (err) {
      console.error("Failed to close support room: ", err);
    }
  };

  // Filter & Search Support Rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // 1. Filter by status / unread
      if (roomFilter === "open" && room.status !== "open") return false;
      if (roomFilter === "closed" && room.status !== "closed") return false;
      if (roomFilter === "unread" && room.userUnreadCount === 0) return false;

      // 2. Filter by search query
      if (searchQuery.trim() === "") return true;
      const term = searchQuery.toLowerCase();
      return (
        room.topic.toLowerCase().includes(term) ||
        room.lastMessageText.toLowerCase().includes(term)
      );
    });
  }, [rooms, roomFilter, searchQuery]);

  // Filtered Messages inside Active Room based on keyword search
  const searchedMessages = useMemo(() => {
    if (!messageSearchQuery.trim()) return messages;
    const term = messageSearchQuery.toLowerCase();
    return messages.filter(m => m.content.toLowerCase().includes(term));
  }, [messages, messageSearchQuery]);

  const activeRoom = rxRoom(selectedRoomId);
  function rxRoom(id: string | null): SupportRoom | undefined {
    return rooms.find(r => r.id === id);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-black text-2xl text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-blue-600 animate-pulse" />
            Patient Helpdesk Support
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium select-none">
            Direct real-time secure communication with the licensed pharmacists and administrators of <strong>{pharmacyName}</strong>
          </p>
        </div>

        <button
          onClick={() => setIsCreatingRoom(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs tracking-wide uppercase rounded-xl transition-all duration-200 shadow-md shadow-blue-500/15 cursor-pointer font-mono"
        >
          <Plus className="w-4 h-4 text-white" />
          New Helpdesk Thread
        </button>
      </div>

      {/* Grid Layout containing archives and active chat windows */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden min-h-[620px] h-[calc(100vh-13rem)]">
        
        {/* Left column - Organized Conversations & Search */}
        <div className="lg:col-span-4 border-r border-slate-200 flex flex-col bg-slate-50/50">
          
          {/* List Search Bar */}
          <div className="p-4 border-b border-slate-200/80 space-y-3 bg-white">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="w-4 h-4 text-slate-400" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics or messages..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide no-scrollbar">
              {(["all", "open", "closed", "unread"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setRoomFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize font-mono text-[10px] tracking-tight shrink-0 transition cursor-pointer border ${
                    roomFilter === filter
                      ? "bg-blue-50 text-blue-650 border-blue-100 shadow-sm font-black"
                      : "bg-white hover:bg-slate-100 border-slate-200 text-slate-650"
                  }`}
                >
                  {filter === "unread" ? (
                    <span className="flex items-center gap-1.5">
                      Unread
                      {rooms.some(r => r.userUnreadCount > 0) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                      )}
                    </span>
                  ) : filter}
                </button>
              ))}
            </div>
          </div>

          {/* Rooms List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2.5 space-y-1">
            {filteredRooms.length === 0 ? (
              <div className="p-12 text-center text-slate-400 max-w-sm mx-auto">
                <Inbox className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-850">No organized conversations found</p>
                <p className="text-[11px] text-slate-400 mt-1 select-none">
                  {roomFilter !== "all" 
                    ? "Try resetting filters or initiating a fresh support thread to connect with staff."
                    : "Create a new conversation topic and a consultant of our clinical center will join the chat."}
                </p>
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = room.id === selectedRoomId;
                const hasUnread = room.userUnreadCount > 0;
                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`w-full text-left p-3 rounded-xl transition duration-200 cursor-pointer flex flex-col gap-1 border ${
                      isSelected 
                        ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10" 
                        : "bg-white border-slate-150 hover:bg-slate-100 hover:border-slate-300 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-slate-900"}`}>
                          {room.topic}
                        </span>
                        {room.status === "closed" && (
                          <span className="bg-slate-200 text-slate-700 text-[8px] font-mono font-bold uppercase tracking-tight px-1 py-0.5 rounded shrink-0">Closed</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {hasUnread && (
                          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                            {room.userUnreadCount}
                          </span>
                        )}
                        <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-blue-100" : "text-slate-400"}`} />
                      </div>
                    </div>

                    <p className={`text-[11px] truncate w-full ${isSelected ? "text-blue-50/90 font-medium" : "text-slate-600 font-medium"}`}>
                      {room.lastMessageText}
                    </p>

                    <div className="flex items-center justify-between w-full text-[9px] font-mono font-medium mt-1">
                      <span className={isSelected ? "text-blue-100" : "text-slate-400"}>
                        {new Date(room.lastMessageAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                      <span className={`flex items-center gap-1 shrink-0 ${isSelected ? "text-blue-100" : "text-green-600"}`}>
                        <Clock className="w-2.5 h-2.5" />
                        Live Support
                      </span>
                    </div>

                  </button>
                );
              })
            )}
          </div>
          
        </div>

        {/* Right column - Main Chat Workspace */}
        <div className="lg:col-span-8 flex flex-col bg-white h-full relative">
          
          {activeRoom ? (
            <>
              {/* Active Conversation Detail Header */}
              <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 border border-blue-200 shadow-inner">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="font-sans font-black text-slate-900 text-sm sm:text-base leading-none">
                      {activeRoom.topic}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500">
                        Room: <strong className="font-mono">{activeRoom.id}</strong>
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                      <span className={`text-[10px] font-bold ${activeRoom.status === "open" ? "text-emerald-600" : "text-red-500"}`}>
                        {activeRoom.status === "open" ? "Connected to Admin Desk" : "Closed Ticket"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Chat Search Inside Messages */}
                  <div className="relative hidden sm:block">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search active messages..."
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none focus:border-blue-500 w-44"
                    />
                  </div>

                  {activeRoom.status === "open" && (
                    <button
                      onClick={() => handleCloseRoom(activeRoom.id)}
                      className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-250 border border-slate-200 rounded-lg text-[10px] uppercase font-mono tracking-wider font-extrabold cursor-pointer hover:bg-slate-200"
                    >
                      Close Ticket
                    </button>
                  )}
                </div>
              </div>

              {/* Chat messages viewport */}
              <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-27rem)] bg-slate-50/20">
                {searchedMessages.length === 0 ? (
                  <div className="text-center p-12 text-slate-400 text-xs">
                    {messageSearchQuery 
                      ? "No message contents match this search keyword." 
                      : "Type a detailed query below to communicate with our licensing team."}
                  </div>
                ) : (
                  searchedMessages.map((msg) => {
                    const isSelf = msg.senderRole === "patient";
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 max-w-[80%] ${isSelf ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                      >
                        {/* Sender Avatar */}
                        {!isSelf && (
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-150 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 self-end">
                            HP
                          </div>
                        )}

                        <div className="flex flex-col">
                          {/* Sender name label */}
                          <span className={`text-[9px] font-mono font-semibold text-slate-450 mb-0.5 ${isSelf ? "text-right" : "text-left"}`}>
                            {isSelf ? "You" : msg.senderName} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {/* Bubble */}
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                              isSelf 
                                ? "bg-blue-600 text-white rounded-tr-none" 
                                : "bg-white border border-slate-200 text-slate-800 rounded-tl-none font-medium"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>

                          {/* Read Receipts for patient messages */}
                          {isSelf && (
                            <div className="flex items-center justify-end gap-1 text-[9px] font-mono text-slate-400 mt-1 select-none">
                              {msg.isRead ? (
                                <>
                                  <span className="text-emerald-600 font-bold">Seen</span>
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                </>
                              ) : (
                                <>
                                  <span>Sent</span>
                                  <Check className="w-3.5 h-3.5 text-slate-400" />
                                </>
                              )}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input form */}
              <div className="p-4 border-t border-slate-200 bg-white">
                {activeRoom.status === "closed" ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-semibold select-none flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-slate-400" />
                    This conversation is closed. Start a new helpdesk thread to request alternative help.
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex gap-2 max-w-5xl mx-auto">
                    <input
                      type="text"
                      required
                      placeholder="Ask the Administrator anything about your orders or pharmacy support..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-slate-800 shadow-sm"
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition duration-150 shadow-md shadow-blue-500/10 flex items-center justify-center shrink-0 cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 text-slate-200 mb-2" />
              <h3 className="font-sans font-black text-slate-700">Administrative Helpdesk Messaging</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">No thread active. Select an organized topic file from the sidebar archive or open a fresh ticket.</p>
            </div>
          )}

        </div>

      </div>

      {/* Creation Modal for a New Helpdesk Room */}
      {isCreatingRoom && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md border border-slate-100 overflow-hidden animate-fade-in">
            <div className="p-5 bg-gradient-to-r from-blue-700 to-blue-600 text-white flex justify-between items-center">
              <div>
                <h3 className="font-sans font-black text-sm">Open Helpdesk Ticket</h3>
                <p className="text-[10px] text-blue-100 mt-0.5 font-medium select-none">Connect with one of our licensing pharmacy agents</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingRoom(false)}
                className="text-white hover:text-blue-100 focus:outline-none cursor-pointer"
              >
                <Plus className="w-5 h-5 rotate-45 transform" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono font-black text-slate-400">
                  Support Category / Topic
                </label>
                <select
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-850 font-bold"
                >
                  {TOPICS.map((topic) => (
                    <option key={topic} value={topic}>{topic}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-mono font-black text-slate-400">
                  Initial Message / Context
                </label>
                <textarea
                  required
                  rows={4}
                  value={newRoomFirstMessage}
                  onChange={(e) => setNewRoomFirstMessage(e.target.value)}
                  placeholder="Explain your request in detail. Mention any Order IDs, specific clinical details, or shipment concerns if applicable..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase font-mono tracking-wider rounded-xl transition duration-150 shadow-md shadow-blue-500/10 cursor-pointer"
              >
                Initiate Chat Ticket
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
