import React, { useState, useEffect } from "react";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { collection, doc, query, onSnapshot, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { Order, PatientProfile, Message } from "../types";
import { 
  Users, ShoppingBag, DollarSign, ShieldCheck, MessageSquare, 
  Send, Phone, Check, RefreshCw, Key, ShieldAlert, FileText, 
  AlertTriangle, Copy, ExternalLink, Calendar, Truck, CheckCircle, Clock, X
} from "lucide-react";

interface PharmacyConsoleProps {
  onBackToApp: () => void;
  staffUser: any;
}

export default function PharmacyConsole({ onBackToApp, staffUser }: PharmacyConsoleProps) {
  // Real-time Firestore Sync state
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<(PatientProfile & { id: string })[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientChat, setSelectedPatientChat] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  
  // Local admin bypass for local testing/demo convenience
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  
  // Dashboard view settings
  const [activeSubTab, setActiveSubTab] = useState<"orders" | "conversations" | "funnels">("orders");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // WhatsApp Funnel state
  const [whatsAppPhone, setWhatsAppPhone] = useState<string>("");
  const [whatsAppTemplateType, setWhatsAppTemplateType] = useState<"dispatch" | "rx_request" | "clinical_warning" | "consultation">("dispatch");
  const [customWhatsAppData, setCustomWhatsAppData] = useState<any>({
    patientName: "",
    orderId: "",
    totalAmount: "",
    conflictDetails: ""
  });
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  // Selected Patient Profile edit states
  const [editName, setEditName] = useState<string>("");
  const [editAge, setEditAge] = useState<string>("");
  const [editGender, setEditGender] = useState<string>("");
  const [editAllergies, setEditAllergies] = useState<string>("");
  const [editChronic, setEditChronic] = useState<string>("");
  const [editMedications, setEditMedications] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Prefill profile edit inputs when a patient is selected
  useEffect(() => {
    if (selectedPatientId) {
      const p = profiles.find((profile) => profile.id === selectedPatientId);
      if (p) {
        setEditName(p.name || "");
        setEditAge(p.age ? String(p.age) : "");
        setEditGender(p.gender || "");
        setEditAllergies(p.allergies || "");
        setEditChronic(p.chronicConditions || "");
        setEditMedications(p.currentMedications || "");
        setEditNotes(p.notes || "");
      }
    }
  }, [selectedPatientId, profiles]);

  // Save updated customer medical record back to Firestore
  const handleSavePatientProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    setIsSavingProfile(true);
    try {
      const profileRef = doc(db, "profiles", selectedPatientId);
      await setDoc(profileRef, {
        name: editName,
        age: editAge ? parseInt(editAge, 10) || 0 : 0,
        gender: editGender,
        allergies: editAllergies,
        chronicConditions: editChronic,
        currentMedications: editMedications,
        notes: editNotes,
      }, { merge: true });
      alert("Successfully updated clinical electronic health record (EHR) in live database!");
    } catch (err: any) {
      console.error("Failed to commit profile updates:", err);
      alert("Unauthorized: Please log in using the administrator's authorized account credentials.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Auto-detect admin authentication
  const hasAuthAdmin = staffUser?.email === "brythema@gmail.com";
  const isAuthorized = hasAuthAdmin || isAdminUnlocked;

  // Real-time listener for Patient Profiles
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    if (isAuthorized) {
      try {
        const ref = collection(db, "profiles");
        unsubscribe = onSnapshot(ref, (snapshot) => {
          const list: (PatientProfile & { id: string })[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data() as PatientProfile, id: docSnap.id });
          });
          setProfiles(list);
        }, (err) => {
          console.warn("Subscribing to profiles blocked by Firestore rules. Please utilize Whitelisted Account.");
        });
      } catch (err) {
        console.error(err);
      }
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthorized]);

  // Real-time listener for Orders
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    if (isAuthorized) {
      try {
        const ref = collection(db, "orders");
        unsubscribe = onSnapshot(ref, (snapshot) => {
          const list: Order[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data() as Order, id: docSnap.id });
          });
          // Sort by id / date descending
          list.sort((a, b) => b.id.localeCompare(a.id));
          setOrders(list);
        }, (err) => {
          console.warn("Subscribing to orders blocked by Firestore rules. Utilized administrator profile.");
        });
      } catch (err) {
        console.error(err);
      }
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthorized]);

  // Real-time listener for Selected patient's chat messages
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    if (isAuthorized && selectedPatientId) {
      setChatLoading(true);
      try {
        const chatRef = collection(db, "chats", selectedPatientId, "messages");
        unsubscribe = onSnapshot(chatRef, (snapshot) => {
          const list: Message[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data() as Message, id: docSnap.id });
          });
          list.sort((a, b) => a.id.localeCompare(b.id));
          setSelectedPatientChat(list);
          setChatLoading(false);
        }, (err) => {
          console.error("Failed to sync chat stream", err);
          setChatLoading(false);
        });
      } catch (err) {
        console.error(err);
        setChatLoading(false);
      }
    } else {
      setSelectedPatientChat([]);
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthorized, selectedPatientId]);

  // Pre-fill WhatsApp form with selected order details
  useEffect(() => {
    if (selectedOrder) {
      setWhatsAppPhone(""); // reset or infer
      setCustomWhatsAppData({
        patientName: selectedOrder.patientName || "Valued Customer",
        orderId: selectedOrder.id,
        totalAmount: selectedOrder.total.toLocaleString("en-NG", { minimumFractionDigits: 2 }),
        conflictDetails: "Penicillin allergy vs Amoxil conflict warning detected."
      });
    }
  }, [selectedOrder]);

  // Passcode unlock trigger for local live testing override
  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim().toUpperCase() === "H-MEDIX-STAFF" || passcode.trim().toUpperCase() === "ADMIN") {
      setIsAdminUnlocked(true);
      setUnlockError(null);
    } else {
      setUnlockError("Invalid Clinical Staff Authorization credentials.");
    }
  };

  // Status transition handle in Firestore
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: "Reviewing" | "Dispensed" | "Ready for Pickup" | "Out for Delivery" | "Delivered") => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: nextStatus });
      
      // Update local state if needed (snapshot triggers anyways)
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: nextStatus });
      }
    } catch (err) {
      console.error("Firestore status modification failed. Reverting...", err);
      alert("Permission alert: You must run this using of H-Medix Clinical Staff authorization.");
    }
  };

  // Send direct message response to user's chat subcollection in Firestore
  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !replyText.trim()) return;

    const msgId = "pharmacist-" + Date.now();
    const pharmacistMsg: Message = {
      id: msgId,
      role: "assistant",
      content: `💊 [H-Medix Pharmacist Response]: ${replyText}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    try {
      await setDoc(doc(db, "chats", selectedPatientId, "messages", msgId), pharmacistMsg);
      setReplyText("");
    } catch (err) {
      console.error("Failed to write pharmacist consultation message:", err);
      alert("Verification failed. Please review your administrative permissions inside Firestore registry.");
    }
  };

  // WhatsApp click funnel builder
  const getWhatsAppURLAndText = () => {
    const pName = customWhatsAppData.patientName || "Valued H-Medix Patient";
    const ordId = customWhatsAppData.orderId || "TRANS-" + Math.floor(100000 + Math.random()*900000);
    const amt = customWhatsAppData.totalAmount || "0.00";
    const conflict = customWhatsAppData.conflictDetails || "Clinical record check requirements.";
    
    let text = "";
    
    switch (whatsAppTemplateType) {
      case "dispatch":
        text = `🇳🇬 *H-Medix Clinical Dispatch Alert* 🇳🇬\n\nDear ${pName},\n\nYour clinical pharmacy order *#${ordId}* has been audited, dispensed, and handed over to our courier. \n\n🏍️ *Delivery Progress:* Out for Delivery.\n💳 *Amount Pending:* ₦${amt} (Naira).\n\nPlease ensure your device is reachable for the dispatch supervisor. Thank you for choosing H-Medix Clinic.`;
        break;
      case "rx_request":
        text = `📝 *H-Medix Prescription Verification Request* 📝\n\nDear ${pName},\n\nOur Chief Pharmacist is audit-checking your checkout prescription order *#${ordId}*. \n\n⚠️ *Clinical Rule:* An active physician prescription (Rx) is required to dispense critical clinical substances in this cart.\n\n📸 Please snap and send a clear photo of your prescription directly via this chat for immediate clearance.`;
        break;
      case "clinical_warning":
        text = `🚨 *H-Medix AI Clinical Safety Notice* 🚨\n\nDear ${pName},\n\nWe detected a *Critical Clinical Alert* in your pharmacy audit queue regarding order *#${ordId}*:\n\n*Safety Check:* ${conflict}\n\nOur duty clinical nurse Sarah wishes to review your dosage schedule before finalizing courier dispatch to avoid adverse drug events. Please let us know if we can proceed.`;
        break;
      case "consultation":
        text = `💬 *H-Medix Tele-Consultation Schedule* 💬\n\nDear ${pName},\n\nTo ensure your therapeutic success, we have scheduled a brief phone consultation with an H-Medix licensed pharmacist regarding the medications ordered under transaction *#${ordId}*.\n\n🗓️ *Status:* Scheduled.\n\nPlease reply with your preferred video/voice call window. Your safety remains our absolute priority.`;
        break;
    }

    const cleanPhone = whatsAppPhone.replace(/[^0-9]/g, "");
    // Default prefix 234 if starting with 0
    let finalPhone = cleanPhone;
    if (cleanPhone.startsWith("0")) {
      finalPhone = "234" + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith("234") && cleanPhone.length > 0) {
      finalPhone = "234" + cleanPhone;
    }

    const encodedText = encodeURIComponent(text);
    return {
      text,
      webUrl: `https://web.whatsapp.com/send?phone=${finalPhone}&text=${encodedText}`,
      mobileUrl: `https://wa.me/${finalPhone}?text=${encodedText}`
    };
  };

  const currentWhatsAppInfo = getWhatsAppURLAndText();

  const handleCopyText = () => {
    navigator.clipboard.writeText(currentWhatsAppInfo.text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  // Helper algorithms: clinical auto warnings checked on expansion
  const generateClinicalSafetyWarning = (order: Order, patientProfile: PatientProfile | undefined) => {
    if (!patientProfile) return null;
    
    const warnings: string[] = [];
    const orderedDrugNames = order.items.map(item => item.drug.name.toLowerCase());
    const allergiesText = (patientProfile.allergies || "").toLowerCase();
    const chronicText = (patientProfile.chronicConditions || "").toLowerCase();
    const medicationsText = (patientProfile.currentMedications || "").toLowerCase();

    // 1. Check Allergies
    if (allergiesText.includes("penicillin") || allergiesText.includes("cepha")) {
      const hasSuspect = orderedDrugNames.some(name => 
        name.includes("penicillin") || name.includes("amox") || name.includes("augmentin") || name.includes("cef")
      );
      if (hasSuspect) {
        warnings.push(`⚠️ SEVERE ALLERGY CONTRAINDICATION: Patient history reports allergy to Penicillin compounds. Checked items contain Beta-Lactam chemical profiles.`);
      }
    }
    
    if (allergiesText.includes("sulfa") || allergiesText.includes("sulfonamide")) {
      const hasSuspect = orderedDrugNames.some(name => name.includes("sulfa") || name.includes("bactrim") || name.includes("co-trimoxazole"));
      if (hasSuspect) {
        warnings.push(`⚠️ SEVERE ALLERGY WARNING: Active Sulfa allergy conflict. Ordered substances contain sulfonamide ingredients.`);
      }
    }

    // 2. Check Decongestant vs Hypertension
    if (chronicText.includes("blood pressure") || chronicText.includes("hypertension") || chronicText.includes("heart")) {
      const hasDecongestant = orderedDrugNames.some(name => 
        name.includes("sudafed") || name.includes("pseudoephedrine") || name.includes("phenylephrine") || name.includes("cold")
      );
      if (hasDecongestant) {
        warnings.push(`🚨 CHRONIC ILLNESS ALERT: Patient is treated for cardiovascular hypertension. Checked items contain systemic vasoconstrictor decongestants.`);
      }
    }

    // 3. Blood thinners vs NSAIDs
    if (medicationsText.includes("aspirin") || medicationsText.includes("warfarin") || medicationsText.includes("plavix") || medicationsText.includes("clopidogrel")) {
      const hasNSAId = orderedDrugNames.some(name => 
        name.includes("advil") || name.includes("ibuprofen") || name.includes("motrin") || name.includes("naproxen") || name.includes("aleve")
      );
      if (hasNSAId) {
        warnings.push(`🚨 DRUG-DRUG CO-ADMINISTRATION WARNING: Double anti-platelet / hemorrhage risk. Co-administering systemic NSAIDs alongside chronic oral anticoagulants.`);
      }
    }

    // 4. Duplicate therapies check
    const categories = order.items.map(i => i.drug.category);
    const uniqueCategories = new Set(categories);
    if (uniqueCategories.size < categories.length) {
      warnings.push(`⚠️ THERAPEUTIC DUPLICATION: Cart contains multiple agents from the same clinical therapeutic class. Potential overdose risk.`);
    }

    return warnings.length > 0 ? warnings : null;
  };

  // Mock calculations for display dashboard metrics
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const activeOrders = orders.filter(o => o.status !== "Delivered");
  const pendingAudits = orders.filter(o => o.status === "Reviewing");
  const uniquePatientsCount = profiles.length > 0 ? profiles.length : Math.max(new Set(orders.map(o => o.userId)).size, 1);

  // Status Badge Stylings
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Reviewing":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-600 border border-amber-200">● Reviewing</span>;
      case "Dispensed":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-50 text-purple-600 border border-purple-200">● Dispensed</span>;
      case "Ready for Pickup":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-600 border border-blue-200">● Ready Picker</span>;
      case "Out for Delivery":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-50 text-sky-600 border border-sky-200">🏍️ Out Delivery</span>;
      case "Delivered":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">✓ Delivered</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono bg-slate-100 text-slate-600">● {status}</span>;
    }
  };

  const filteredOrders = orders.filter(o => statusFilter === "all" ? true : o.status === statusFilter);

  return (
    <div id="pharmacy-console" className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      
      {/* Top Console Navigation */}
      <header className="bg-slate-905 text-white shadow-xl px-4 sm:px-6 lg:px-8 py-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-700 to-blue-500 text-white font-black text-xs font-mono px-3 py-1.5 rounded-lg border border-blue-400/30">
              MED-CONSOLE v2.6
            </div>
            <div>
              <h1 className="font-display font-black text-xl tracking-tight leading-none">
                H-MEDIX CLINICAL CONSOLE
              </h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase mt-1">
                Nigeria Pharmacy & Patient Management Network
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isAuthorized ? (
              <span className="inline-flex items-center gap-1 bg-emerald-950 text-emerald-400 text-xs font-mono px-3 py-1.5 rounded-full border border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" /> SECURE STAFF CONNECTEDED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-rose-950 text-rose-400 text-xs font-mono px-3 py-1.5 rounded-full border border-rose-800 animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5" /> UNVERIFIED ACCESS LIMITS
              </span>
            )}

            <button
              id="back-to-portal-btn"
              onClick={onBackToApp}
              className="bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white px-4 py-2 rounded-lg border border-slate-700 transition duration-200"
            >
              Back to Patient View
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Console Container */}
      {!isAuthorized ? (
        <div className="flex-1 max-w-lg mx-auto w-full flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 shadow-sm leading-none">
                <Key className="w-6 h-6" />
              </div>
              <h2 className="font-display font-extrabold text-xl text-slate-905">
                Clinical Credentials Check
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                This operations portal serves H-Medix Clinic clinical personnel only. Please input your secure access code to synchronize live patient data.
              </p>
            </div>

            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase font-bold text-slate-500 mb-1.5">
                  Staff Access Passcode
                </label>
                <div className="relative">
                  <input
                    id="passcode-input"
                    type="password"
                    placeholder="Enter Staff Passcode (Tip: ADMIN)"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-wider text-slate-900 font-mono"
                  />
                </div>
                {unlockError && (
                  <p className="text-xs text-rose-600 font-medium mt-1.5 flex items-center gap-1">
                    ⚠️ {unlockError}
                  </p>
                )}
              </div>

              <button
                id="unlock-console-btn"
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition duration-200 shadow-md shadow-blue-500/10 hover:shadow-lg"
              >
                Authenticate Live Connection
              </button>
            </form>

            <div className="pt-4 border-t border-slate-100 text-center">
              <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                H-Medix Security Regulations • 2026 TLS 1.3
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          
          {/* Summary KPI Panel Grid */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
                  Total Managed Sales
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 block mt-1">
                  ₦{totalRevenue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
                  Active Dispatches
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 block mt-1">
                  {activeOrders.length}
                </span>
              </div>
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
                  Pending AI Audits
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 block mt-1">
                  {pendingAudits.length}
                </span>
              </div>
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100">
                <ShieldAlert className="w-5 h-5 font-bold" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
                  Registered Patients
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 block mt-1">
                  {uniquePatientsCount}
                </span>
              </div>
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center border border-purple-100">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </section>

          {/* Sub-Tabs Switch */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveSubTab("orders")}
              className={`pb-3 px-6 font-display font-bold text-sm tracking-tight transition-all relative ${
                activeSubTab === "orders" 
                  ? "text-blue-600 font-extrabold border-b-2 border-blue-600" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Order & Safety Registry ({orders.length})
            </button>
            <button
              onClick={() => setActiveSubTab("conversations")}
              className={`pb-3 px-6 font-display font-bold text-sm tracking-tight transition-all relative ${
                activeSubTab === "conversations" 
                  ? "text-blue-600 font-extrabold border-b-2 border-blue-600" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Live Chat & Patient Intercourse ({profiles.length})
            </button>
            <button
              onClick={() => setActiveSubTab("funnels")}
              className={`pb-3 px-6 font-display font-bold text-sm tracking-tight transition-all relative ${
                activeSubTab === "funnels" 
                  ? "text-blue-600 font-extrabold border-b-2 border-blue-600" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              WhatsApp Support Pipeline
            </button>
          </div>

          {/* Sub-Tab Windows */}
          {activeSubTab === "orders" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Order List Queue (Left Column) */}
              <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-display font-black text-slate-905 text-base leading-tight">
                      Prescription Dispensation Queue
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">
                      Updated live via Secure Firestore pipeline
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      id="status-filter-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-slate-655"
                    >
                      <option value="all">All Dispatches</option>
                      <option value="Reviewing">Reviewing</option>
                      <option value="Dispensed">Dispensed</option>
                      <option value="Ready for Pickup">Ready for PW</option>
                      <option value="Out for Delivery">Out for Delivery</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
                  {filteredOrders.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <ShoppingBag className="w-8 h-8 mx-auto stroke-[1.5] text-slate-300 mb-2" />
                      <p className="text-sm font-semibold">No transactions found matching this queue.</p>
                      <p className="text-xs text-slate-400 mt-1">Ensure patient is authorized or orders are created.</p>
                    </div>
                  ) : (
                    filteredOrders.map((order) => {
                      const isSelected = selectedOrder?.id === order.id;
                      const hasItems = order.items && order.items.length > 0;
                      return (
                        <div
                          key={order.id}
                          id={`order-row-${order.id}`}
                          onClick={() => setSelectedOrder(order)}
                          className={`p-4 transition duration-200 cursor-pointer flex justify-between items-start gap-4 ${
                            isSelected ? "bg-blue-50/50 border-l-4 border-l-blue-600" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-400">
                                #{order.id}
                              </span>
                              <span className="font-display font-medium text-sm text-slate-805">
                                {order.patientName}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-mono">
                              {order.timestamp} • {hasItems ? `${order.items.length} therapeutic item(s)` : "Empty"}
                            </p>
                            <div className="flex flex-wrap gap-1 pt-1.5">
                              {order.items?.map((item, idx) => (
                                <span key={idx} className="inline-block bg-slate-100 text-[10px] text-slate-655 px-2 py-0.5 rounded-md border border-slate-150">
                                  {item.drug?.name} ({item.quantity}x)
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="text-right space-y-1.5 flex flex-col items-end">
                            <span className="font-mono text-sm font-bold text-slate-900 block">
                              ₦{order.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                            </span>
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Order Detail Panel & Clinical Crosscheck (Right Column) */}
              <div className="lg:col-span-5 space-y-6">
                {selectedOrder ? (
                  <div id="order-details-pane" className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden sticky top-6">
                    <div className="p-4 bg-slate-905 text-white flex justify-between items-center">
                      <div>
                        <h4 className="font-display font-bold text-sm tracking-tight leading-none text-white">
                          Transaction #{selectedOrder.id}
                        </h4>
                        <span className="text-[9px] font-mono text-slate-400 block mt-1 uppercase">
                          Placed by {selectedOrder.patientName}
                        </span>
                      </div>
                      <button 
                        onClick={() => setSelectedOrder(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Interactive Courier Dispatch Pipeline Control */}
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 space-y-2.5">
                        <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-blue-500" /> Pipeline Status Actions
                        </span>
                        
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            id="btn-status-dispensed"
                            onClick={() => handleUpdateOrderStatus(selectedOrder.id, "Dispensed")}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition duration-150 ${
                              selectedOrder.status === "Dispensed" 
                                ? "bg-purple-600 text-white" 
                                : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-705"
                            }`}
                          >
                            ✓ Admin Dispense
                          </button>
                          <button
                            id="btn-status-ready"
                            onClick={() => handleUpdateOrderStatus(selectedOrder.id, "Ready for Pickup")}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition duration-150 ${
                              selectedOrder.status === "Ready for Pickup" 
                                ? "bg-blue-600 text-white" 
                                : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-705"
                            }`}
                          >
                            ✓ Ready Picker
                          </button>
                          <button
                            id="btn-status-out"
                            onClick={() => handleUpdateOrderStatus(selectedOrder.id, "Out for Delivery")}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition duration-150 ${
                              selectedOrder.status === "Out for Delivery" 
                                ? "bg-sky-600 text-white inline-flex items-center justify-center gap-1" 
                                : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-705 inline-flex items-center justify-center gap-1"
                            }`}
                          >
                            🏍️ Dispatch Courier
                          </button>
                          <button
                            id="btn-status-delivered"
                            onClick={() => handleUpdateOrderStatus(selectedOrder.id, "Delivered")}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition duration-150 ${
                              selectedOrder.status === "Delivered" 
                                ? "bg-emerald-600 text-white" 
                                : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-705"
                            }`}
                          >
                            ✓ Mark Delivered
                          </button>
                        </div>
                      </div>

                      {/* Items Breakdowns */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider block">
                          Checkout Drugs Cart Info
                        </span>
                        
                        <div className="divide-y divide-slate-100 rounded-xl border border-slate-150 p-3 bg-white space-y-2 max-h-48 overflow-y-auto">
                          {selectedOrder.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center py-1.5 text-xs">
                              <div>
                                <span className="font-mono text-blue-500 font-bold mr-1">
                                  [{item.quantity}x]
                                </span>
                                <span className="text-slate-800 font-semibold">{item.drug?.name}</span>
                              </div>
                              <span className="font-mono text-slate-500">
                                ₦{((item.drug?.price || 0) * item.quantity).toLocaleString("en-NG")}
                              </span>
                            </div>
                          ))}
                          
                          <div className="flex justify-between items-center pt-2 font-bold text-sm text-slate-905 border-t border-slate-150">
                            <span>Paid Total (Courier Incl.)</span>
                            <span className="font-mono text-blue-650">
                              ₦{selectedOrder.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Clinical crosscheck warnings check against user's actual profile! */}
                      {(() => {
                        const patProfile = profiles.find(p => p.id === selectedOrder.userId);
                        const warnings = generateClinicalSafetyWarning(selectedOrder, patProfile);
                        return (
                          <div className="space-y-2.5">
                            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider block">
                              Automated Clinical Crosscheck Auditing
                            </span>

                            {patProfile ? (
                              <div className="bg-slate-50 rounded-xl p-3 border border-slate-150 space-y-2 text-xs text-slate-655">
                                <div className="flex justify-between font-bold border-b border-slate-150 pb-1 text-slate-900 flex-wrap">
                                  <span>👤 {patProfile.name}</span>
                                  <span className="font-mono text-[10px]">Age: {patProfile.age || "N/A"} ({patProfile.gender || "N/A"})</span>
                                </div>
                                <p><strong className="text-slate-700">Allergies:</strong> {patProfile.allergies || "No active record on database"}</p>
                                <p><strong className="text-slate-700">Chronic Illnesses:</strong> {patProfile.chronicConditions || "No active record on database"}</p>
                                <p><strong className="text-slate-700">Daily Medications:</strong> {patProfile.currentMedications || "No active record on database"}</p>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-slate-150 flex items-center justify-center p-4 bg-slate-50 text-slate-400 text-xs text-center">
                                <AlertTriangle className="w-4 h-4 mr-1 text-amber-500 shrink-0" />
                                Patient Medical Record offline (User placed guest billing checkout). Custom cross-check bypassed safely.
                              </div>
                            )}

                            {/* Alert banners if allergies / drugs interact */}
                            {warnings && (
                              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 space-y-1.5">
                                <span className="text-[10px] uppercase font-mono font-bold text-rose-600 block">
                                  ⛔ CRITICAL INTERACTIONS CONFLICT
                                </span>
                                {warnings.map((warn, i) => (
                                  <p key={i} className="text-xs text-rose-700 leading-relaxed font-semibold">
                                    {warn}
                                  </p>
                                ))}
                              </div>
                            )}

                            {!warnings && patProfile && (
                              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2 text-emerald-700 text-xs">
                                <Check className="w-4 h-4 text-emerald-500 shrink-0 font-extrabold" />
                                <div>
                                  <strong className="block font-bold">Standard Safety Verified</strong>
                                  Current drug combination detected safe against allergy records.
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Launch Quick WhatsApp dispatch shortcut */}
                      <button
                        onClick={() => {
                          setActiveSubTab("funnels");
                          setWhatsAppTemplateType("dispatch");
                        }}
                        className="w-full bg-slate-900 border border-slate-800 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition duration-200 hover:bg-slate-805"
                      >
                        <Phone className="w-3.5 h-3.5" /> Initialize Whatsapp Delivery Dropoff
                      </button>

                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-205 rounded-2xl p-12 text-center text-slate-400 leading-relaxed">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold">No dispatch transaction selected.</p>
                    <p className="text-xs text-slate-400 mt-1">Select any order row under the prescription registry list to audit patient safety parameters.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Sub-Tab Patients Chat Triage (Middle Tab) */}
          {activeSubTab === "conversations" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Patient List Column */}
              <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                  <h3 className="font-display font-black text-slate-905 text-base">
                    Patient Triage Directory
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">
                    Select patient to inspect demographic & chat queue
                  </p>
                </div>

                <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
                  {profiles.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-semibold">No patients active on live Cloud Database.</p>
                      <p className="text-xs text-slate-400 mt-1">Ask the user to insert medical entries inside Patient Profiles panel.</p>
                    </div>
                  ) : (
                    profiles.map((p) => {
                      const isSelected = selectedPatientId === p.id;
                      return (
                        <div
                          key={p.id}
                          id={`patient-row-${p.id}`}
                          onClick={() => setSelectedPatientId(p.id)}
                          className={`p-4 transition duration-200 cursor-pointer flex items-center gap-3 ${
                            isSelected ? "bg-blue-50/50 border-l-4 border-l-blue-600" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold font-mono shrink-0">
                            {p.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-display font-bold text-xs text-slate-900 truncate">
                              {p.name}
                            </h4>
                            <p className="text-[10px] text-slate-500 font-mono truncate">
                              Allergies: {p.allergies || "None"}
                            </p>
                            <p className="text-[9px] text-slate-400 truncate mt-0.5">
                              Chronic: {p.chronicConditions || "None declared"}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Patient Profile and Chat Workspace details */}
              <div className="lg:col-span-9">
                {selectedPatientId ? (
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    
                    {/* Left sub-column: Patient Electronic Medical Folder (xl:col-span-5) */}
                    <div className="xl:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                      <div className="p-4 bg-indigo-900 text-white flex justify-between items-center">
                        <div>
                          <h4 className="font-display font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                            🛡️ EHR Clinical Folder
                          </h4>
                          <span className="text-[9px] font-mono text-indigo-200 block mt-0.5">
                            Database UID: {selectedPatientId}
                          </span>
                        </div>
                      </div>

                      <form onSubmit={handleSavePatientProfile} className="p-5 space-y-4">
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase font-mono font-bold text-slate-400">
                            Patient Demographics
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[9px] font-semibold text-slate-500 block mb-1">Full Legal Name</span>
                              <input
                                type="text"
                                required
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 font-medium"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[9px] font-semibold text-slate-500 block mb-1">Age</span>
                                <input
                                  type="number"
                                  required
                                  value={editAge}
                                  onChange={(e) => setEditAge(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] font-semibold text-slate-500 block mb-1">Gender</span>
                                <select
                                  value={editGender}
                                  onChange={(e) => setEditGender(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-900 focus:ring-1 focus:ring-indigo-500 font-medium"
                                >
                                  <option value="">Select</option>
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                  <option value="Other">Other</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1">
                            ⚠️ Drug Allergies & Hypersensitivity
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Penicillin, Sulfa Compounds, Aspirin"
                            value={editAllergies}
                            onChange={(e) => setEditAllergies(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 font-medium"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase font-mono font-bold text-slate-400">
                            Chronic Medical Conditions
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Hypertension, Type-2 Diabetes"
                            value={editChronic}
                            onChange={(e) => setEditChronic(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 font-medium"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase font-mono font-bold text-slate-400">
                            Ongoing Daily Therapeutics / Medications
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Lisinopril 10mg daily"
                            value={editMedications}
                            onChange={(e) => setEditMedications(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 font-medium"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase font-mono font-bold text-slate-400">
                            Confidential Clinic Notes
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Type confidential clinic details regarding patient drug compliance history..."
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 font-medium"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSavingProfile}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-2 px-4 rounded-xl text-xs transition duration-150 flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer"
                        >
                          {isSavingProfile ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          Save Medical File
                        </button>
                      </form>
                    </div>

                    {/* Right sub-column: Clinical Message Queue Chat Workspace (xl:col-span-7) */}
                    <div className="xl:col-span-7">
                      <div id="patient-chat-box" className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col min-h-[520px] bg-slate-50">
                        
                        {/* Selected Patient Name Header */}
                        {(() => {
                          const activePatient = profiles.find(p => p.id === selectedPatientId);
                          return (
                            <div className="p-4 bg-slate-905 text-white flex justify-between items-center px-5 flex-wrap gap-2">
                              <div>
                                <h4 className="font-display font-extrabold text-xs text-white">
                                  Teleconsult Queue: {activePatient?.name || "Patient Record"}
                                </h4>
                                <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                                  Active EHR Profile loaded. Replies bypass safety exceptions.
                                </span>
                              </div>
                              
                              <button
                                onClick={() => {
                                  setSelectedPatientId(null);
                                }}
                                className="text-slate-400 hover:text-white cursor-pointer"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          );
                        })()}

                        {/* Chat Bubble Container Area */}
                        <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[350px] bg-white">
                          {chatLoading ? (
                            <div className="flex justify-center items-center h-48">
                              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                            </div>
                          ) : selectedPatientChat.length === 0 ? (
                            <div className="text-center p-12 text-slate-400 text-xs">
                              No messages synced yet with this customer. Write below to initialize first communication checkpoint.
                            </div>
                          ) : (
                            selectedPatientChat.map((msg) => {
                              const isStaff = msg.content.includes("[H-Medix Pharmacist Response]");
                              const cleanContent = msg.content.replace("💊 [H-Medix Pharmacist Response]: ", "");
                              const isAssistant = msg.role === "assistant";
                              
                              return (
                                <div
                                  key={msg.id}
                                  className={`flex flex-col max-w-[85%] ${
                                    isAssistant ? "mr-auto items-start" : "ml-auto items-end"
                                  }`}
                                >
                                  {/* Meta Label above bubbles */}
                                  <span className="text-[9px] font-mono text-slate-400 mb-1">
                                    {isStaff ? "🛡️ Licensed Pharmacist (Staff)" : isAssistant ? "🤖 Nurse Sarah AI Helper" : "👤 Patient Customer"} • {msg.timestamp}
                                  </span>

                                  {/* Chat core bubbles */}
                                  <div
                                    className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                                      isStaff 
                                        ? "bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium" 
                                        : isAssistant 
                                          ? "bg-slate-100 text-slate-800" 
                                          : "bg-blue-600 text-white"
                                    }`}
                                  >
                                    {cleanContent}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Pharmacist Response Input Form */}
                        <form onSubmit={handleSendResponse} className="p-4 bg-slate-50 border-t border-slate-150 flex gap-3 items-center">
                          <input
                            id="pharmacist-reply-input"
                            type="text"
                            placeholder="Type professional checkup message to override Nurse Sarah..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-sans"
                          />
                          <button
                            id="pharmacist-send-reply-btn"
                            type="submit"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2.5 rounded-xl transition duration-150 shadow-md shadow-emerald-500/15 text-xs flex items-center justify-center shrink-0 cursor-pointer"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>

                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-205 rounded-2xl p-12 text-center text-slate-400">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold">No active patient conversation selected.</p>
                    <p className="text-xs text-slate-400 mt-1">Select a patient row from the directory feed on the left to review chat consultation logs and reply clinically.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Sub-Tab WhatsApp Funnel Support (Third Tab) */}
          {activeSubTab === "funnels" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Template selectors & dynamic forms (Left Column) */}
              <div className="lg:col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                  <h3 className="font-display font-black text-slate-905 text-base">
                    WhatsApp CRM Funnel Generator
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">
                    Select communication triggers to draft click-to-chat redirections
                  </p>
                </div>

                <div className="p-5 space-y-5">
                  {/* Select WhatsApp trigger event */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase font-bold text-slate-500">
                      Funnel Trigger Pipeline
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setWhatsAppTemplateType("dispatch")}
                        className={`p-3 rounded-xl border text-left flex flex-col space-y-1 transition duration-150 ${
                          whatsAppTemplateType === "dispatch"
                            ? "border-blue-600 bg-blue-50/50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-bold text-xs text-slate-900">🏍️ Order Courier Out</span>
                        <span className="text-[9px] text-slate-500 leading-none">Custom delivery dispatch info</span>
                      </button>

                      <button
                        onClick={() => setWhatsAppTemplateType("rx_request")}
                        className={`p-3 rounded-xl border text-left flex flex-col space-y-1 transition duration-150 ${
                          whatsAppTemplateType === "rx_request"
                            ? "border-blue-600 bg-blue-50/50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-bold text-xs text-slate-900">📝 Upload RX Prescription</span>
                        <span className="text-[9px] text-slate-500 leading-none">Substance verification check</span>
                      </button>

                      <button
                        onClick={() => setWhatsAppTemplateType("clinical_warning")}
                        className={`p-3 rounded-xl border text-left flex flex-col space-y-1 transition duration-150 ${
                          whatsAppTemplateType === "clinical_warning"
                            ? "border-blue-600 bg-blue-50/50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-bold text-xs text-slate-900">🚨 Safety Co-admin Alert</span>
                        <span className="text-[9px] text-slate-500 leading-none">Allergy or double interaction warning</span>
                      </button>

                      <button
                        onClick={() => setWhatsAppTemplateType("consultation")}
                        className={`p-3 rounded-xl border text-left flex flex-col space-y-1 transition duration-150 ${
                          whatsAppTemplateType === "consultation"
                            ? "border-blue-600 bg-blue-50/50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-bold text-xs text-slate-900">💬 Schedule Consultation</span>
                        <span className="text-[9px] text-slate-500 leading-none">Offer video or voice checkpoint</span>
                      </button>
                    </div>
                  </div>

                  {/* Input Fields */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono uppercase font-bold text-slate-500 mb-1">
                          Patient Phone (WhatsApp Format)
                        </label>
                        <input
                          id="whatsapp-phone-input"
                          type="text"
                          placeholder="08031234567 or 23480..."
                          value={whatsAppPhone}
                          onChange={(e) => setWhatsAppPhone(e.target.value)}
                          className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono uppercase font-bold text-slate-500 mb-1">
                          Patient Full Name
                        </label>
                        <input
                          type="text"
                          value={customWhatsAppData.patientName}
                          onChange={(e) => setCustomWhatsAppData({ ...customWhatsAppData, patientName: e.target.value })}
                          className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900 font-sans font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono uppercase font-bold text-slate-500 mb-1">
                          Order Ticket Code
                        </label>
                        <input
                          type="text"
                          value={customWhatsAppData.orderId}
                          onChange={(e) => setCustomWhatsAppData({ ...customWhatsAppData, orderId: e.target.value })}
                          className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono uppercase font-bold text-slate-500 mb-1">
                          Invoice Total Amount (₦)
                        </label>
                        <input
                          type="text"
                          value={customWhatsAppData.totalAmount}
                          onChange={(e) => setCustomWhatsAppData({ ...customWhatsAppData, totalAmount: e.target.value })}
                          className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900 font-mono"
                        />
                      </div>
                    </div>

                    {whatsAppTemplateType === "clinical_warning" && (
                      <div>
                        <label className="block text-xs font-mono uppercase font-bold text-slate-500 mb-1">
                          Specific Contraindication Conflict Details
                        </label>
                        <textarea
                          rows={2}
                          value={customWhatsAppData.conflictDetails}
                          onChange={(e) => setCustomWhatsAppData({ ...customWhatsAppData, conflictDetails: e.target.value })}
                          className="w-full bg-slate-55 border border-slate-200 rounded-lg p-3 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900 font-sans"
                        />
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Dynamic Live Preview & Redirection Launchers (Right Column) */}
              <div className="lg:col-span-6 bg-slate-905 text-white rounded-2xl p-5 space-y-5 border border-slate-800 flex flex-col h-full justify-between">
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">
                      Live Telecommunication CRM Preview
                    </span>
                    <button
                      onClick={handleCopyText}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-400 hover:text-white"
                    >
                      {copiedSuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedSuccess ? "Copied" : "Copy Template"}
                    </button>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-4 border border-slate-850 font-mono text-xs leading-relaxed text-slate-200 whitespace-pre-line select-all min-h-[180px]">
                    {currentWhatsAppInfo.text}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <p className="text-[10px] text-slate-400 font-sans text-center">
                    Redirections automatically configure active phone links inside Nigeria dial code (*+234*). H-Medix complies securely with patient data shielding parameters.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      id="launch-whatsapp-web-btn"
                      href={currentWhatsAppInfo.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-center text-xs flex items-center justify-center gap-1.5 transition duration-200 shadow-lg shadow-emerald-700/10"
                    >
                      <ExternalLink className="w-4 h-4" /> Launch WhatsApp Web (Desktop)
                    </a>
                    
                    <a
                      id="launch-whatsapp-mobile-btn"
                      href={currentWhatsAppInfo.mobileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl text-center text-xs flex items-center justify-center gap-1.5 transition duration-200 border border-slate-700"
                    >
                      <Phone className="w-4 h-4" /> Launch WhatsApp Mobile
                    </a>
                  </div>
                </div>

              </div>
              
            </div>
          )}

        </div>
      )}

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center mt-auto">
        <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
          © 2026 H-Medix Pharmacy Clinic Group Nigeria • High Contrast Medical Console
        </span>
      </footer>

    </div>
  );
}
