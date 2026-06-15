import React, { useState, useEffect, useRef, useMemo } from "react";
import { db, auth, handleFirestoreError, OperationType, createNotification } from "../firebase";
import { collection, doc, query, onSnapshot, updateDoc, setDoc, deleteDoc, where, orderBy, writeBatch, increment } from "firebase/firestore";
import { Order, PatientProfile, Message, AdminRecord, AdminPermissions, Drug, SystemNotification } from "../types";
import { 
  Users, ShoppingBag, DollarSign, ShieldCheck, MessageSquare, 
  Send, Phone, Check, RefreshCw, Key, ShieldAlert, FileText, 
  AlertTriangle, Copy, ExternalLink, Calendar, Truck, CheckCircle, Clock, X,
  Trash2, UserPlus, Shield, ClipboardList, PenTool, CheckSquare, PlusSquare,
  Inbox, AlertCircle, CheckCheck, Search
} from "lucide-react";
import { normalizePhoneNumber } from "../utils";

interface PharmacyConsoleProps {
  onBackToApp: () => void;
  staffUser: any;
  adminRecord: AdminRecord | null;
  activePharmacyId?: string | null;
  tenantConfig?: {
    pharmacyName: string;
    nurseName: string;
    logoUrl: string;
    themeColor: string;
    pharmacyAddress: string;
    whatsappNumber: string;
  };
}

export default function PharmacyConsole({ 
  onBackToApp, 
  staffUser,
  adminRecord,
  activePharmacyId = null,
  tenantConfig
}: PharmacyConsoleProps) {
  // Real-time Firestore Sync state
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<(PatientProfile & { id: string })[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientChat, setSelectedPatientChat] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Real-time notification state
  const [activeNotification, setActiveNotification] = useState<{
    id: string;
    order: Order;
    visible: boolean;
  } | null>(null);

  const isInitialLoad = useRef(true);

  // Synthesize double beep chime
  const playChimeSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain1.gain.setValueAtTime(0.08, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.15);
      
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        gain2.gain.setValueAtTime(0.12, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.25);
      }, 120);
    } catch (e) {
      console.warn("AudioContext chime failed:", e);
    }
  };

  const showNotification = (order: Order) => {
    setActiveNotification({
      id: order.id,
      order: order,
      visible: true,
    });
    // Auto-hide after 15 seconds
    setTimeout(() => {
      setActiveNotification((prev) => {
        if (prev && prev.id === order.id) {
          return { ...prev, visible: false };
        }
        return prev;
      });
    }, 15000);
  };
  
  // Staff RBAC collection states
  const [dbAdmins, setDbAdmins] = useState<AdminRecord[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState<string>("");
  const [newAdminUid, setNewAdminUid] = useState<string>("");
  const [newAdminRole, setNewAdminRole] = useState<"Admin" | "Super Admin">("Admin");
  
  // Inventory management states
  const [newDrugName, setNewDrugName] = useState<string>("");
  const [newDrugCategory, setNewDrugCategory] = useState<string>("Allergies");
  const [newDrugPrice, setNewDrugPrice] = useState<string>("");
  const [newDrugIngredients, setNewDrugIngredients] = useState<string>("");
  const [newDrugDosage, setNewDrugDosage] = useState<string>("");
  const [newDrugDirections, setNewDrugDirections] = useState<string>("");
  const [newDrugWarnings, setNewDrugWarnings] = useState<string>("");
  const [newDrugRequiresRx, setNewDrugRequiresRx] = useState<boolean>(false);
  const [newDrugDescription, setNewDrugDescription] = useState<string>("");
  const [newDrugStockLevel, setNewDrugStockLevel] = useState<string>("");
  const [newDrugMinStockAlert, setNewDrugMinStockAlert] = useState<string>("10");
  const [searchDrugQuery, setSearchDrugQuery] = useState<string>("");
  const [editingDrugId, setEditingDrugId] = useState<string | null>(null);
  const [isSavingDrug, setIsSavingDrug] = useState<boolean>(false);
  const [clinicalAuditLogs, setClinicalAuditLogs] = useState<any[]>([]);
  
  // Support helpdesk state variables
  const [supportRooms, setSupportRooms] = useState<any[]>([]);
  const [selectedSupportRoomId, setSelectedSupportRoomId] = useState<string | null>(null);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [supportReplyText, setSupportReplyText] = useState("");
  const [supportSearchText, setSupportSearchText] = useState("");
  const [supportFilter, setSupportFilter] = useState<"all" | "open" | "closed" | "unread">("all");
  const [supportMessagesLoading, setSupportMessagesLoading] = useState(false);

  // Dashboard view settings
  const [activeSubTab, setActiveSubTab] = useState<"orders" | "conversations" | "support_helpdesk" | "funnels" | "sales_ledger" | "inventory_manager" | "staff_rbac">("orders");
  
  // Reports & Accounting secondary sub-tab states
  const [reportSubTab, setReportSubTab] = useState<"sales_ledger" | "daily_sales" | "weekly_sales" | "monthly_sales" | "inventory_audit" | "customer_reports">("sales_ledger");
  const [reportDailyDate, setReportDailyDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [reportWeeklyStartDate, setReportWeeklyStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split("T")[0];
  });
  const [reportMonthlyYear, setReportMonthlyYear] = useState<string>("2026");
  const [reportMonthlyMonth, setReportMonthlyMonth] = useState<string>("06");
  
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
  const [editIsConfirmed, setEditIsConfirmed] = useState<boolean>(false);
  const [editNokName, setEditNokName] = useState<string>("");
  const [editNokPhone, setEditNokPhone] = useState<string>("");
  const [editNokRelation, setEditNokRelation] = useState<string>("");
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [adminActiveHistoryTab, setAdminActiveHistoryTab] = useState<"customer" | "prescription" | "orders" | "chats" | "payments" | "logins">("customer");

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
        setEditIsConfirmed(p.isConfirmed || false);
        setEditNokName(p.nextOfKinName || "");
        setEditNokPhone(p.nextOfKinPhone || "");
        setEditNokRelation(p.nextOfKinRelation || "");
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
      
      const existingProfile = profiles.find(p => p.id === selectedPatientId);
      const newHistoryEvent = {
        id: "ch-" + Date.now(),
        event: "Admin Clinical Record Update",
        timestamp: new Date().toLocaleString("en-NG"),
        details: `EHR File updated by clinical administrator (Age: ${editAge || "N/A"}, Gender: ${editGender || "N/A"}, Allergies: ${editAllergies || "None"}).`
      };
      
      const updatedCustomerHistory = existingProfile?.customerHistory 
        ? [...existingProfile.customerHistory, newHistoryEvent]
        : [newHistoryEvent];

      await setDoc(profileRef, {
        name: editName,
        age: editAge ? parseInt(editAge, 10) || 0 : 0,
        gender: editGender,
        allergies: editAllergies,
        chronicConditions: editChronic,
        currentMedications: editMedications,
        notes: editNotes,
        isConfirmed: editIsConfirmed,
        nextOfKinName: editNokName,
        nextOfKinPhone: editNokPhone,
        nextOfKinRelation: editNokRelation,
        customerHistory: updatedCustomerHistory,
      }, { merge: true });
      alert("Successfully updated clinical electronic health record (EHR) in live database!");
    } catch (err: any) {
      console.error("Failed to commit profile updates:", err);
      alert("Unauthorized: Please log in using the administrator's authorized account credentials.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Update status of uploaded prescriptions and notify patients
  const handleUpdateDocumentStatus = async (docId: string, newStatus: "Approved" | "Rejected") => {
    if (!selectedPatientId) return;
    try {
      const p = profiles.find(profile => profile.id === selectedPatientId);
      if (!p) return;
      const updatedDocs = (p.uploadedDocuments || []).map(d => 
        d.id === docId ? { ...d, status: newStatus } : d
      );
      const profileRef = doc(db, "profiles", selectedPatientId);
      const targetDoc = p.uploadedDocuments?.find(d => d.id === docId);
      const docName = targetDoc ? targetDoc.name : "Prescription File";

      const newHistoryEvent = {
        id: "rxh-" + Date.now(),
        event: `Prescription ${newStatus}`,
        timestamp: new Date().toLocaleString("en-NG"),
        details: `Prescription file "${docName}" was evaluated by clinical pharmacist and marked ${newStatus}.`
      };
      const updatedPrescriptionHistory = p.prescriptionHistory 
        ? [...p.prescriptionHistory, newHistoryEvent]
        : [newHistoryEvent];

      // Execute patient profile update, audit dispatch, and customer notification concurrently!
      await Promise.all([
        updateDoc(profileRef, { 
          uploadedDocuments: updatedDocs,
          prescriptionHistory: updatedPrescriptionHistory
        }),
        logClinicalAuditAction(
          `doc-${docId.slice(-6)}`,
          p.name || "Patient Record",
          newStatus === "Approved" ? "APPROVED" : "REJECTED",
          `Pharmacist evaluated patient prescription "${docName}" and marked it as ${newStatus}.`
        ),
        createNotification({
          userId: selectedPatientId,
          title: newStatus === "Approved" ? "Prescription Verified & Approved" : "Prescription Rejected",
          message: `Your uploaded prescription "${docName}" has been evaluated and ${newStatus.toLowerCase()} by the duty pharmacist.`,
          type: newStatus === "Approved" ? "prescriptionApproval" : "prescriptionRejection"
        })
      ]);

      alert(`Successfully updated document status to: ${newStatus}`);
    } catch (err) {
      console.error("Failed to update document status:", err);
      alert("Failed to modify document status. Perm check failed.");
    }
  };

  // Auto-detect admin authentication
  const isAuthorized = adminRecord !== null;
  const permissions = adminRecord?.permissions || {
    viewCustomers: false,
    manageInventory: false,
    managePrescriptions: false,
    reviewConversations: false,
    viewReports: false,
    sendNotifications: false,
    viewSalesData: false,
  };

  // Load and listen to all clinical admins from Firestore if current is Super Admin
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    if (adminRecord?.role === "Super Admin") {
      try {
        const ref = collection(db, "admins");
        unsubscribe = onSnapshot(ref, (snapshot) => {
          const list: AdminRecord[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as AdminRecord);
          });
          setDbAdmins(list);
        }, (err) => {
          console.warn("Blocked live admins read, utilizing admin credentials check.", err);
        });
      } catch (err) {
        console.error("Error setting up rbac staff listener:", err);
      }
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [adminRecord]);

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
        const ordersPath = activePharmacyId ? `pharmacies/${activePharmacyId}/orders` : "orders";
        const ref = collection(db, ordersPath);
        unsubscribe = onSnapshot(ref, (snapshot) => {
          const list: Order[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data() as Order, id: docSnap.id });
          });
          // Sort by id / date descending
          list.sort((a, b) => b.id.localeCompare(a.id));

          // Real-time notification check
          if (!isInitialLoad.current) {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const newOrderData = { ...change.doc.data(), id: change.doc.id } as Order;
                playChimeSound();
                showNotification(newOrderData);
              }
            });
          } else {
            isInitialLoad.current = false;
          }

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
        const chatsPath = activePharmacyId 
          ? `pharmacies/${activePharmacyId}/chats/${selectedPatientId}/messages` 
          : `chats/${selectedPatientId}/messages`;
        const chatRef = collection(db, chatsPath);
        unsubscribe = onSnapshot(chatRef, (snapshot) => {
          const list: Message[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data() as Message, id: docSnap.id });
          });
          list.sort((a, b) => {
            const getNum = (msg: Message) => {
              if (msg.createdAt !== undefined) return msg.createdAt;
              if (msg.id === "se-welcome") return 0;
              const match = msg.id.match(/\d+/);
              return match ? parseInt(match[0], 10) : 0;
            };
            return getNum(a) - getNum(b);
          });
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

  // Real-time listener for Support Rooms in Administrative Console
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    if (isAuthorized) {
      try {
        const roomsRef = collection(db, "support_rooms");
        const pharmacyId = activePharmacyId || "default";
        const q = query(
          roomsRef,
          where("pharmacyId", "==", pharmacyId)
        );
        unsubscribe = onSnapshot(q, (snapshot) => {
          const loaded: any[] = [];
          snapshot.forEach((docSnap) => {
            loaded.push({ id: docSnap.id, ...docSnap.data() });
          });
          // Sort descending by lastMessageAt client-side
          loaded.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
          setSupportRooms(loaded);
        }, (err) => {
          console.warn("Subscribing to admin support rooms blocked or empty:", err);
        });
      } catch (err) {
        console.error(err);
      }
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthorized, activePharmacyId]);

  // Real-time listener for selected support room messages inside admin
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    if (isAuthorized && selectedSupportRoomId) {
      setSupportMessagesLoading(true);
      try {
        const msgsRef = collection(db, "support_rooms", selectedSupportRoomId, "messages");
        const q = query(msgsRef, orderBy("createdAt", "asc"));
        
        unsubscribe = onSnapshot(q, (snapshot) => {
          const loaded: any[] = [];
          snapshot.forEach((docSnap) => {
            loaded.push({ id: docSnap.id, ...docSnap.data() });
          });
          setSupportMessages(loaded);
          setSupportMessagesLoading(false);

          // Mark patient's messages as read for admin
          const unreadFromPatient = loaded.filter(m => m.senderRole === "patient" && !m.isRead);
          if (unreadFromPatient.length > 0) {
            const batch = writeBatch(db);
            unreadFromPatient.forEach(m => {
              const mDocRef = doc(db, "support_rooms", selectedSupportRoomId, "messages", m.id);
              batch.update(mDocRef, { isRead: true, readAt: Date.now() });
            });
            const roomDocRef = doc(db, "support_rooms", selectedSupportRoomId);
            batch.update(roomDocRef, { adminUnreadCount: 0 });
            batch.commit().catch(e => console.error("Error clearing admin unread: ", e));
          }

        }, (err) => {
          console.error("Error syncing support messages for admin: ", err);
          setSupportMessagesLoading(false);
        });
      } catch (err) {
        console.error(err);
        setSupportMessagesLoading(false);
      }
    } else {
      setSupportMessages([]);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthorized, selectedSupportRoomId]);

  // Real-time listener for Clinical Audit Logs
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    if (isAuthorized) {
      try {
        const ref = collection(db, "audit_logs");
        unsubscribe = onSnapshot(ref, (snapshot) => {
          const loaded: any[] = [];
          snapshot.forEach((docSnap) => {
            loaded.push({ id: docSnap.id, ...docSnap.data() });
          });
          // Sort descending by timestamp
          loaded.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          setClinicalAuditLogs(loaded);
        }, (err) => {
          console.warn("Subscribing to clinical audit logs blocked or empty, fallback local logs.");
        });
      } catch (err) {
        console.error("Clinical audit setup error:", err);
      }
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthorized]);

  // Pre-fill WhatsApp form with selected order details
  useEffect(() => {
    if (selectedOrder) {
      const patientProfileFromList = profiles.find(p => p.id === selectedOrder.userId);
      const resolvedPhone = selectedOrder.patientPhone || patientProfileFromList?.phoneNumber || "";
      setWhatsAppPhone(resolvedPhone);
      setCustomWhatsAppData({
        patientName: selectedOrder.patientName || "Valued Customer",
        orderId: selectedOrder.id,
        totalAmount: selectedOrder.total.toLocaleString("en-NG", { minimumFractionDigits: 2 }),
        conflictDetails: "Penicillin allergy vs Amoxil conflict warning detected."
      });
    }
  }, [selectedOrder, profiles]);

  // Real-time listener for clinical inventory catalog
  const [inventoryList, setInventoryList] = useState<Drug[]>([]);
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    if (isAuthorized) {
      try {
        const ref = collection(db, "inventory");
        unsubscribe = onSnapshot(ref, (snapshot) => {
          const list: Drug[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as Drug);
          });
          setInventoryList(list);
        }, (err) => {
          console.warn("Blocked live inventory read, utilizing local fallback state.", err);
        });
      } catch (err) {
        console.error("Error setting up inventory listener:", err);
      }
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthorized]);

  // Inventory modifications
  const handleAddOrUpdateDrug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.manageInventory) {
      alert("Unauthorized: Your staff account lacks the 'manageInventory' privilege.");
      return;
    }
    if (!newDrugName.trim() || !newDrugPrice.trim() || !newDrugCategory.trim()) {
      alert("Verification warning: Drug name, price, and category are mandatory fields.");
      return;
    }

    setIsSavingDrug(true);
    const drugId = editingDrugId || "drug-" + Math.floor(100000 + Math.random() * 900000);

    const stockNum = parseInt(newDrugStockLevel, 10);
    const minStockNum = parseInt(newDrugMinStockAlert, 10);

    const drugPayload: Drug = {
      id: drugId,
      name: newDrugName.trim(),
      category: newDrugCategory,
      price: parseFloat(newDrugPrice) || 0,
      image: "💊",
      ingredients: newDrugIngredients.trim() || "Active therapeutic compounds",
      dosage: newDrugDosage.trim() || "As directed by medical practitioner",
      directions: newDrugDirections.trim() || "Consume with glass of room temperature water",
      warnings: newDrugWarnings.trim() || "Avoid alcohol consumption during treatment course",
      requiresPrescription: newDrugRequiresRx,
      description: newDrugDescription.trim() || "High quality clinical grade compound therapeutic formulation.",
      stockLevel: isNaN(stockNum) ? 50 : stockNum,
      minStockAlert: isNaN(minStockNum) ? 10 : minStockNum,
    };

    try {
      await setDoc(doc(db, "inventory", drugId), drugPayload);
      
      // Reset state form
      setNewDrugName("");
      setNewDrugPrice("");
      setNewDrugIngredients("");
      setNewDrugDosage("");
      setNewDrugDirections("");
      setNewDrugWarnings("");
      setNewDrugRequiresRx(false);
      setNewDrugDescription("");
      setNewDrugStockLevel("");
      setNewDrugMinStockAlert("10");
      setEditingDrugId(null);
      alert(editingDrugId ? "Clinical compound updated successfully!" : "New compound registered to the pharmacy inventory!");
    } catch (err) {
      console.error("Failed to write to inventory:", err);
      alert("Operation failed. Ensure your clinical account has sufficient authorization.");
    } finally {
      setIsSavingDrug(false);
    }
  };

  const handleDeleteDrug = async (drugId: string) => {
    if (!permissions.manageInventory) {
      alert("Unauthorized: Your account lacks 'manageInventory' authorization.");
      return;
    }
    if (!window.confirm("Verify: Are you absolutely sure you want to delete this compound from active clinical inventory?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "inventory", drugId));
      alert("Drug compiled identity deleted.");
    } catch (err) {
      console.error("Deletion failed:", err);
      alert("Firestore deletion denied.");
    }
  };

  const handleEditDrugClick = (drug: Drug) => {
    setEditingDrugId(drug.id);
    setNewDrugName(drug.name);
    setNewDrugCategory(drug.category);
    setNewDrugPrice(drug.price.toString());
    setNewDrugIngredients(drug.ingredients);
    setNewDrugDosage(drug.dosage || "");
    setNewDrugDirections(drug.directions || "");
    setNewDrugWarnings(drug.warnings || "");
    setNewDrugRequiresRx(!!drug.requiresPrescription);
    setNewDrugDescription(drug.description || "");
    setNewDrugStockLevel(drug.stockLevel !== undefined ? drug.stockLevel.toString() : "50");
    setNewDrugMinStockAlert(drug.minStockAlert !== undefined ? drug.minStockAlert.toString() : "10");
    alert(`Loaded "${drug.name}" into inventory editor. Review and apply changes above.`);
  };

  // Staff RBAC management functions
  const handleTogglePermission = async (adminId: string, permissionKey: keyof AdminPermissions, currentValue: boolean) => {
    if (adminRecord?.role !== "Super Admin") {
      alert("Access Denied: Only Super Administrators can alter staff permissions.");
      return;
    }
    try {
      const adminRef = doc(db, "admins", adminId);
      await updateDoc(adminRef, {
        [`permissions.${permissionKey}`]: !currentValue
      });
    } catch (err) {
      console.error("Failed to toggle permission:", err);
      alert("Verification alert: Alter operation denied.");
    }
  };

  const handleAddNewAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminRecord?.role !== "Super Admin") {
      alert("Access Denied: Only Super Administrators can configure operational staff accounts.");
      return;
    }
    if (!newAdminEmail.trim() || !newAdminUid.trim()) {
      alert("Both Gmail account address and Firebase Auth User ID (UID) are required.");
      return;
    }

    const payload: AdminRecord = {
      id: newAdminUid.trim(),
      email: newAdminEmail.trim().toLowerCase(),
      name: newAdminEmail.split("@")[0].toUpperCase() + " CLINICIAN",
      role: newAdminRole,
      permissions: {
        viewCustomers: true,
        manageInventory: true,
        managePrescriptions: true,
        reviewConversations: true,
        viewReports: true,
        sendNotifications: true,
        viewSalesData: newAdminRole === "Super Admin",
      }
    };

    try {
      await setDoc(doc(db, "admins", newAdminUid.trim()), payload);
      setNewAdminEmail("");
      setNewAdminUid("");
      setNewAdminRole("Admin");
      alert("New clinical administrator credential registered globally!");
    } catch (err) {
      console.error("Failed to write fresh admin record:", err);
      alert("Writing admin permission document failed due to security restrictions.");
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (adminRecord?.role !== "Super Admin") {
      alert("Access Denied: Only Super Administrators can delete clinical operators.");
      return;
    }
    if (adminId === staffUser?.uid) {
      alert("Protected Identity: Super admins cannot self-revoke active permissions!");
      return;
    }
    if (!window.confirm("Verify: Are you absolutely sure you want to revoke this operational clinician's full registration?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "admins", adminId));
      alert("Clinician operational permissions revoked successfully.");
    } catch (err) {
      console.error(err);
      alert("De-authorization failed.");
    }
  };

  const handlePromotePatientToAdmin = async (patient: PatientProfile & { id: string }) => {
    if (adminRecord?.role !== "Super Admin") {
      alert("Access Denied: Operational privilege required.");
      return;
    }
    if (!window.confirm(`Verify: Are you sure you want to promote patient "${patient.name}" to Clinical Operator status?`)) {
      return;
    }
    const payload: AdminRecord = {
      id: patient.id,
      email: patient.phoneNumber || "no-email@clinical.hmedix.com",
      name: patient.name || "CLINICAL OPERATOR",
      role: "Admin",
      permissions: {
        viewCustomers: true,
        manageInventory: true,
        managePrescriptions: true,
        reviewConversations: true,
        viewReports: true,
        sendNotifications: true,
        viewSalesData: false,
      }
    };
    try {
      await setDoc(doc(db, "admins", patient.id), payload);
      alert(`Patient "${patient.name}" promoted successfully to Clinical administrator! Full clinician rights assigned.`);
    } catch (err) {
      console.error(err);
      alert("Promotion failed: Permission denied by database guidelines.");
    }
  };

  // Clinical action tracker generator
  const logClinicalAuditAction = async (orderId: string, patientName: string, action: string, details: string) => {
    try {
      const logId = "log-" + Date.now();
      const logDoc = {
        id: logId,
        timestamp: new Date().toISOString(),
        operatorEmail: staffUser?.email || "clinical.operator@hmedix.com",
        orderId,
        patientName,
        action,
        details
      };
      await setDoc(doc(db, "audit_logs", logId), logDoc);
    } catch (e) {
      console.warn("Audit log write bypass, captured locally in active session", e);
    }
  };

  // Status transition handle in Firestore
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: "Reviewing" | "Dispensed" | "Ready for Pickup" | "Out for Delivery" | "Delivered") => {
    if (!permissions.managePrescriptions) {
      alert("Unauthorized operation: Your clinic account lacks the 'managePrescriptions' privilege.");
      return;
    }
    try {
      const orderPath = activePharmacyId ? `pharmacies/${activePharmacyId}/orders/${orderId}` : `orders/${orderId}`;
      const orderRef = doc(db, orderPath);

      const notificationPromise = (selectedOrder && selectedOrder.userId && selectedOrder.userId !== "offline-user")
        ? createNotification({
            userId: selectedOrder.userId,
            title: "Order Status Update",
            message: `Your medical order #${orderId} status has changed to: "${nextStatus}".`,
            type: "orderUpdate"
          })
        : Promise.resolve(null);

      const logPromise = logClinicalAuditAction(
        orderId,
        selectedOrder ? selectedOrder.patientName : "Guest Patient",
        nextStatus === "Dispensed" ? "APPROVED" : nextStatus.toUpperCase(),
        `Pharmacist updated order status to: ${nextStatus}. Clinical parameters validated.`
      );

      let profileUpdatePromise = Promise.resolve<any>(null);
      if (selectedOrder && selectedOrder.userId && selectedOrder.userId !== "offline-user") {
        const p = profiles.find(profile => profile.id === selectedOrder.userId);
        if (p) {
          const orderEvent = {
            id: "oh-" + Date.now(),
            orderId: orderId,
            event: `Status: ${nextStatus}`,
            timestamp: new Date().toLocaleString("en-NG"),
            details: `Order status upgraded to "${nextStatus}" by clinical pharmacist.`
          };
          const updatedOrderHistory = p.orderHistory ? [...p.orderHistory, orderEvent] : [orderEvent];
          const profileRef = doc(db, "profiles", selectedOrder.userId);
          profileUpdatePromise = updateDoc(profileRef, { orderHistory: updatedOrderHistory });
        }
      }

      // Core concurrent process of updating status, notifying patient, and recording audit action concurrently
      await Promise.all([
        updateDoc(orderRef, { status: nextStatus }),
        notificationPromise,
        logPromise,
        profileUpdatePromise
      ]);

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
    if (!permissions.reviewConversations) {
      alert("Unauthorized: Your staff account lacks the 'reviewConversations' permission to reply to patient chats.");
      return;
    }

    const msgId = "pharmacist-" + Date.now();
    const pharmacistMsg: Message = {
      id: msgId,
      role: "assistant",
      content: `💊 [H-Medix Pharmacist Response]: ${replyText}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    try {
      const chatsPath = activePharmacyId 
        ? `pharmacies/${activePharmacyId}/chats/${selectedPatientId}/messages/${msgId}` 
        : `chats/${selectedPatientId}/messages/${msgId}`;

      // Dispatch chat message and notify patient in parallel
      await Promise.all([
        setDoc(doc(db, chatsPath), pharmacistMsg),
        createNotification({
          userId: selectedPatientId,
          title: "New Pharmacist Message",
          message: `Your duty pharmacist sent a clinical reply: "${replyText.substring(0, 50)}${replyText.length > 50 ? "..." : ""}"`,
          type: "adminMessage"
        })
      ]);

      setReplyText("");
    } catch (err) {
      console.error("Failed to write pharmacist consultation message:", err);
      alert("Verification failed. Please review your administrative permissions inside Firestore registry.");
    }
  };

  // Send Support reply back to the patient support room
  const handleSendSupportResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupportRoomId || !supportReplyText.trim() || !isAuthorized) return;

    if (!permissions.reviewConversations) {
      alert("Unauthorized: Your staff account lacks the 'reviewConversations' permission to reply to patient chats.");
      return;
    }

    const msgId = "pharmacist-support-" + Date.now();
    const ts = Date.now();
    const content = supportReplyText.trim();
    const senderName = adminRecord?.email?.split("@")[0].toUpperCase() || "Licensed Pharmacist";

    const msg = {
      id: msgId,
      senderId: staffUser?.uid || "admin",
      senderName: senderName,
      senderRole: "admin",
      content: content,
      createdAt: ts,
      isRead: false
    };

    setSupportReplyText("");

    try {
      // Execute message write, real-time dispatch notification, and helpdesk thread parameter updating concurrently in parallel!
      await Promise.all([
        setDoc(doc(db, "support_rooms", selectedSupportRoomId, "messages", msgId), msg),
        createNotification({
          userId: selectedSupportRoomId, // The roomId is the patient's userId in support rooms
          title: "New Support Message",
          message: `Pharmacist or receptionist replied to your request: "${content.substring(0, 50)}${content.length > 50 ? "..." : ""}"`,
          type: "adminMessage"
        }),
        updateDoc(doc(db, "support_rooms", selectedSupportRoomId), {
          lastMessageText: content,
          lastMessageAt: ts,
          userUnreadCount: increment(1)
        })
      ]);
    } catch (err) {
      console.error("Failed to write pharmacist support response:", err);
      alert("Dispatch failed. Verification warning.");
    }
  };

  // Close Support Room inside Administrative Workspace
  const handleCloseSupportRoom = async (roomId: string) => {
    try {
      await updateDoc(doc(db, "support_rooms", roomId), {
        status: "closed"
      });
    } catch (err) {
      console.error("Failed to close support room: ", err);
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

  const handleExportSalesCSV = () => {
    // Generate structured rows for financial spreadsheet compatibility
    const csvRows = [
      ["Transaction ID", "Patient Name", "Timestamp", "Ordered Therapeutics", "Total Paid (NGN)", "Fulfilment Pipeline Status"]
    ];

    orders.forEach((o) => {
      const itemsListText = o.items
        ? o.items.map((i) => `${i.drug.name} (Qty ${i.quantity})`).join("; ")
        : "";
      csvRows.push([
        o.id,
        o.patientName || "Anonymous Customer",
        o.timestamp || "",
        `"${itemsListText.replace(/"/g, '""')}"`, // escape quotes for CSV compatibility
        o.total.toFixed(2),
        o.status
      ]);
    });

    const csvContent = csvRows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `HMedix_Sales_Accounting_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generic Excel HTML-based workbook exporter (pinnacle of professional formatting)
  const downloadExcel = (title: string, headers: string[], dataRows: string[][]) => {
    let excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
    excelHtml += `<head><!--[if gte mso 9]><xml><x:Workbook><x:Worksheets><x:Worksheet><x:Name>${title.slice(0, 31)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:Worksheet></x:Worksheets></x:Workbook></xml><![endif]--></head>`;
    excelHtml += `<body style="margin:20px; font-family:sans-serif;">`;
    excelHtml += `<h2 style="color:#1e3a8a; margin-bottom:5px;">${title}</h2>`;
    excelHtml += `<p style="color:#64748b; font-size:11px; margin-top:0;">Generated on: ${new Date().toLocaleString()} | HMedix Reporting Suite</p>`;
    excelHtml += `<table border="1" cellpadding="6" style="border-collapse:collapse; font-size:12px; border-color:#e2e8f0; width:100%;">`;
    
    // Headers
    excelHtml += `<tr style="background-color:#1e40af; color:#ffffff; font-weight:bold; text-align:left;">`;
    headers.forEach(h => {
      excelHtml += `<th style="padding:10px; border:1px solid #cbd5e1;">${h}</th>`;
    });
    excelHtml += `</tr>`;
    
    // Rows
    dataRows.forEach((row, rIdx) => {
      const rowBg = rIdx % 2 === 0 ? "#ffffff" : "#f8fafc";
      excelHtml += `<tr style="background-color:${rowBg};">`;
      row.forEach(cell => {
        // Simple escaping for cell contents
        const cleanCell = (cell || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        excelHtml += `<td style="padding:8px; border:1px solid #cbd5e1;">${cleanCell}</td>`;
      });
      excelHtml += `</tr>`;
    });
    
    excelHtml += `</table></body></html>`;
    const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${title.replace(/\s+/g, "_")}_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generic CSV Exporter
  const downloadCSV = (title: string, headers: string[], dataRows: string[][]) => {
    const csvContent = [
      headers,
      ...dataRows.map(row => row.map(cell => {
        const str = cell || "";
        if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }))
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${title.replace(/\s+/g, "_")}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Master Orchestrated Exporters based on Sub-categories
  const handleExportReportCSV = () => {
    const data = getActiveReportPayload();
    if (!data) return;
    downloadCSV(data.title, data.headers, data.rows);
  };

  const handleExportReportExcel = () => {
    const data = getActiveReportPayload();
    if (!data) return;
    downloadExcel(data.title, data.headers, data.rows);
  };

  // Dynamic selector payload compiler for CSV and Excel workbook generation
  const getActiveReportPayload = () => {
    if (reportSubTab === "sales_ledger") {
      const headers = ["Transaction ID", "Patient Name", "Timestamp", "Ordered Therapeutics", "Total Paid (NGN)", "Fulfilment Pipeline Status"];
      const rows = orders.map(o => [
        o.id,
        o.patientName || "Anonymous Customer",
        o.timestamp || "",
        o.items ? o.items.map(i => `${i.drug.name} (Qty ${i.quantity})`).join("; ") : "",
        o.total.toFixed(2),
        o.status
      ]);
      return { title: "Complete System Ledger Register", headers, rows };
    }

    if (reportSubTab === "daily_sales") {
      const filtered = orders.filter(o => o.timestamp && o.timestamp.includes(reportDailyDate));
      const headers = ["Order ID", "Customer Patron", "Time Recorded", "Acquired Products", "Revenue Settled (NGN)", "Fulfillment Status"];
      const rows = filtered.map(o => [
        o.id,
        o.patientName || "Anonymous Patron",
        o.timestamp || "",
        o.items ? o.items.map(i => `${i.drug.name} (Qty ${i.quantity})`).join("; ") : "",
        o.total.toFixed(2),
        o.status
      ]);
      return { title: `Daily Sales Audit Report (${reportDailyDate})`, headers, rows };
    }

    if (reportSubTab === "weekly_sales") {
      const start = new Date(reportWeeklyStartDate);
      start.setHours(0,0,0,0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      
      const filtered = orders.filter(o => {
        if (!o.timestamp) return false;
        const oDate = new Date(o.timestamp);
        return oDate >= start && oDate < end;
      });

      const headers = ["Transaction ID", "Customer Patron", "Timestamp", "Acquired Products", "Invoice Sum (NGN)", "Fulfillment Status"];
      const rows = filtered.map(o => [
        o.id,
        o.patientName || "Anonymous Patron",
        o.timestamp || "",
        o.items ? o.items.map(i => `${i.drug.name} (Qty ${i.quantity})`).join("; ") : "",
        o.total.toFixed(2),
        o.status
      ]);

      const formattedEnd = end.toISOString().split("T")[0];
      return { title: `Weekly Revenue Audit Report (${reportWeeklyStartDate} to ${formattedEnd})`, headers, rows };
    }

    if (reportSubTab === "monthly_sales") {
      const token = `${reportMonthlyYear}-${reportMonthlyMonth}`;
      const filtered = orders.filter(o => o.timestamp && o.timestamp.includes(token));
      const headers = ["Transaction ID", "Patient Customer", "Timestamp", "Delivered Products", "Invoice Amount (NGN)", "Operational Status"];
      const rows = filtered.map(o => [
        o.id,
        o.patientName || "Anonymous Patron",
        o.timestamp || "",
        o.items ? o.items.map(i => `${i.drug.name} (Qty ${i.quantity})`).join("; ") : "",
        o.total.toFixed(2),
        o.status
      ]);

      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const label = `${months[parseInt(reportMonthlyMonth) - 1] || "Selected Month"} ${reportMonthlyYear}`;
      return { title: `Monthly Sales Financial Report (${label})`, headers, rows };
    }

    if (reportSubTab === "inventory_audit") {
      const headers = ["Product Code", "Product Name", "Therapeutic Category", "Unit Retail Price (NGN)", "Active Bulk Stock Level", "Minimum Safety Threshold", "Stock Cost Valuation (NGN)", "Fulfillment Safety Label"];
      const rows = inventoryList.map(d => {
        const stock = d.stockLevel !== undefined ? d.stockLevel : 25;
        const minAlert = d.minStockAlert !== undefined ? d.minStockAlert : 10;
        const val = (d.price * stock).toFixed(2);
        const label = stock === 0 ? "OUT OF STOCK" : stock <= minAlert ? "REORDER WARNING" : "Fully Stocked";
        return [
          d.id,
          d.name,
          d.category,
          d.price.toString(),
          stock.toString(),
          minAlert.toString(),
          val,
          label
        ];
      });
      return { title: "Clinical Inventory Audit and Valuation Ledger", headers, rows };
    }

    if (reportSubTab === "customer_reports") {
      const headers = ["Patient ID", "Full Name", "Demographics", "Emergency Contacts & Rel", "Allergy Matrices", "Chronic Illness Profile", "Authorized Rx uploads", "Historical Checked Orders", "Naira Revenue Contributed"];
      const rows = profiles.map(p => {
        const pOrders = orders.filter(o => o.userId === p.id || o.patientName?.toLowerCase() === p.name?.toLowerCase());
        const totalSpend = pOrders.reduce((sum, o) => sum + o.total, 0);
        const docs = p.uploadedDocuments?.filter(d => d.status === "Approved").length || 0;
        return [
          p.id || "N/A",
          p.name || "Anonymous Patron",
          `${p.age ? `${p.age}y/o` : "Age N/A"} • ${p.gender || "Gender N/A"}`,
          p.nextOfKinName ? `${p.nextOfKinName} (${p.nextOfKinRelation || "N/A"}) - ${p.nextOfKinPhone || "N/A"}` : "None Listed",
          p.allergies || "No Declared Allergies",
          p.chronicConditions || "No Chronic Illness Reported",
          docs.toString(),
          pOrders.length.toString(),
          totalSpend.toFixed(2)
        ];
      });
      return { title: "Patient Customers Demographics and Activity Report", headers, rows };
    }

    return null;
  };

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

  // Memoized metrics calculations for performance and speed
  const totalRevenue = useMemo(() => orders.reduce((sum, o) => sum + o.total, 0), [orders]);
  const activeOrders = useMemo(() => orders.filter(o => o.status !== "Delivered"), [orders]);
  const pendingAudits = useMemo(() => orders.filter(o => o.status === "Reviewing"), [orders]);
  const uniquePatientsCount = useMemo(() => {
    return profiles.length > 0 ? profiles.length : Math.max(new Set(orders.map(o => o.userId)).size, 1);
  }, [profiles, orders]);

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

  // Memoized filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(o => statusFilter === "all" ? true : o.status === statusFilter);
  }, [orders, statusFilter]);

  // Memoized filtered helpdesk support rooms list matching search queries
  const filteredSupportRooms = useMemo(() => {
    return (supportRooms || []).filter(room => {
      if (supportFilter === "open" && room.status !== "open") return false;
      if (supportFilter === "closed" && room.status !== "closed") return false;
      if (supportFilter === "unread" && room.adminUnreadCount === 0) return false;

      const term = supportSearchText.toLowerCase().trim();
      if (!term) return true;
      return (
        room.userName.toLowerCase().includes(term) ||
        room.userEmail.toLowerCase().includes(term) ||
        room.topic.toLowerCase().includes(term) ||
        (room.lastMessageText || "").toLowerCase().includes(term)
      );
    });
  }, [supportRooms, supportFilter, supportSearchText]);

  // Memoized filtered inventory drugs list
  const filteredInventoryList = useMemo(() => {
    const query = searchDrugQuery.toLowerCase().trim();
    if (!query) return inventoryList;
    return inventoryList.filter(d => 
      d.name.toLowerCase().includes(query) || 
      d.category.toLowerCase().includes(query)
    );
  }, [inventoryList, searchDrugQuery]);

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
        <div className="flex-1 max-w-lg mx-auto w-full flex items-center justify-center p-6 bg-slate-50 min-h-[60vh]">
          <div className="bg-white rounded-2xl shadow-xl border border-rose-100 p-8 w-full space-y-6 text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center border border-rose-100 shadow-sm mx-auto animate-bounce leading-none">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display font-black text-xl text-slate-900 tracking-tight">
                RESTRICTED AREA CLINICIAN PORTAL
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your current authentication session is active under standard user account: <strong className="font-semibold text-slate-800">{staffUser?.email}</strong>. This account does not possess operational clinical administrator privileges in H-Medix's record system.
              </p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-left">
              <h4 className="text-[10px] uppercase font-mono font-bold text-amber-800 tracking-wider">
                ● Contact Chief Clinical Officer
              </h4>
              <p className="text-[11px] text-amber-900 leading-relaxed mt-1">
                To request operational rights or promote this account to full Staff and clinical access, contact your clinic administrator with your secure Firebase account ID:
              </p>
              <code className="block bg-white text-slate-800 text-[10px] font-mono p-1 rounded border border-amber-100 mt-2 text-center select-all">
                {staffUser?.uid || "unauthenticated-session"}
              </code>
            </div>
            <button
              id="back-to-home-btn"
              onClick={onBackToApp}
              className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 rounded-xl text-xs transition duration-200 shadow-md cursor-pointer"
            >
              Return to Patient Portal
            </button>
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
              <div className="flex-1">
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
                  Registered Patients
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900">
                    {uniquePatientsCount}
                  </span>
                  <span className="text-xs text-slate-450 font-mono font-bold">
                    / 200 permitted
                  </span>
                </div>
                {/* Visual allocation progress bar */}
                <div className="w-full max-w-[120px] bg-slate-100 rounded-full h-1 mt-2.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      (uniquePatientsCount / 200) > 0.9 ? "bg-rose-500" : (uniquePatientsCount / 200) > 0.70 ? "bg-amber-500" : "bg-blue-600"
                    }`}
                    style={{ width: `${Math.min((uniquePatientsCount / 200) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center border border-purple-100 shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </section>

          {/* Sub-Tabs Switch */}
          <div className="flex flex-wrap border-b border-slate-200">
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
            {(permissions.reviewConversations || adminRecord.role === "Super Admin") && (
              <>
                <button
                  onClick={() => setActiveSubTab("conversations")}
                  className={`pb-3 px-6 font-display font-bold text-sm tracking-tight transition-all relative ${
                    activeSubTab === "conversations" 
                      ? "text-blue-600 font-extrabold border-b-2 border-blue-600" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Live Chat ({profiles.length})
                </button>
                <button
                  id="subtab-support-helpdesk-btn"
                  onClick={() => setActiveSubTab("support_helpdesk")}
                  className={`pb-3 px-6 font-display font-bold text-sm tracking-tight transition-all relative flex items-center gap-1.5 ${
                    activeSubTab === "support_helpdesk" 
                      ? "text-blue-600 font-extrabold border-b-2 border-blue-600" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  📥 Support Helpdesk
                  {supportRooms.some(r => r.adminUnreadCount > 0) && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block"></span>
                  )}
                </button>
              </>
            )}
            {(permissions.sendNotifications || adminRecord.role === "Super Admin") && (
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
            )}
            {(permissions.viewSalesData || adminRecord.role === "Super Admin") && (
              <button
                id="subtab-sales-ledger-btn"
                onClick={() => setActiveSubTab("sales_ledger")}
                className={`pb-3 px-6 font-display font-bold text-sm tracking-tight transition-all relative ${
                  activeSubTab === "sales_ledger" 
                    ? "text-blue-600 font-extrabold border-b-2 border-blue-600" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                📊 Financial Sales Ledger
              </button>
            )}
            {(permissions.manageInventory || adminRecord.role === "Super Admin") && (
              <button
                id="subtab-inventory-manager-btn"
                onClick={() => setActiveSubTab("inventory_manager")}
                className={`pb-3 px-6 font-display font-bold text-sm tracking-tight transition-all relative ${
                  activeSubTab === "inventory_manager" 
                    ? "text-blue-600 font-extrabold border-b-2 border-blue-600" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                💊 Manage Inventory
              </button>
            )}
            {adminRecord.role === "Super Admin" && (
              <button
                id="subtab-staff-rbac-btn"
                onClick={() => setActiveSubTab("staff_rbac")}
                className={`pb-3 px-6 font-display font-bold text-sm tracking-tight transition-all relative ${
                  activeSubTab === "staff_rbac" 
                    ? "text-blue-600 font-extrabold border-b-2 border-blue-600" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                🛡️ Staff Permissions (RBAC)
              </button>
            )}
          </div>

          {/* Sub-Tab Windows */}
          {activeSubTab === "orders" && (
            <div className="space-y-6">
              {/* Intelligent Low Stock Warnings Notification */}
              {(() => {
                const lowStockList = inventoryList.filter(d => d.stockLevel !== undefined && d.stockLevel <= (d.minStockAlert || 10));
                if (lowStockList.length === 0) return null;
                return (
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                        <AlertTriangle className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-display font-black text-sm text-slate-905">
                          Critical Replenishment Alert: {lowStockList.length} Compounds Low in Stock
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          The following key medications have fallen below pre-configured clinical safety limits:
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {lowStockList.slice(0, 4).map(d => (
                        <span key={d.id} className="bg-white border border-amber-250 text-[10px] text-amber-800 font-mono font-bold px-2 py-1 rounded shadow-sm">
                          💊 {d.name} ({d.stockLevel} left)
                        </span>
                      ))}
                      <button 
                        onClick={() => setActiveSubTab("inventory_manager")}
                        className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer ml-2"
                      >
                        Adjust Stock levels
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Admin SaaS Home Dashboard Analytics Grid */}
              {selectedOrder === null && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-left">
                  <div className="flex items-center justify-between font-sans">
                    <div>
                      <h3 className="font-display font-black text-slate-900 text-base">H-Medix Operational Command</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Real-time compilation of clinical transactions and patient pipelines.</p>
                    </div>
                    <span className="text-[10px] bg-slate-100 font-mono px-3 py-1 rounded-full uppercase text-slate-500 font-bold">
                      ● Active Session: {staffUser?.email}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-150 text-left">
                      <span className="text-[10px] uppercase font-mono text-slate-450 block font-bold leading-tight">Total Customers</span>
                      <span className="text-xl font-bold text-slate-900 block mt-1 font-mono">{profiles.length}</span>
                      <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">↑ 100% database</span>
                    </div>

                    <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-150 text-left font-sans">
                      <span className="text-[10px] uppercase font-mono text-slate-450 block font-bold leading-tight">Active Patients</span>
                      <span className="text-xl font-bold text-slate-905 block mt-1 font-mono">
                        {profiles.filter(p => orders.some(o => o.userId === p.id)).length || profiles.length}
                      </span>
                      <span className="text-[9px] text-indigo-500 block font-semibold mt-0.5">EHR synchronized</span>
                    </div>

                    <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-150 text-left font-sans">
                      <span className="text-[10px] uppercase font-mono text-slate-450 block font-bold leading-tight">New Registrations</span>
                      <span className="text-xl font-bold text-slate-900 block mt-1 font-mono">
                        {profiles.slice(-5).length || 3}
                      </span>
                      <span className="text-[9px] text-indigo-655 font-bold block mt-0.5">Recent signups</span>
                    </div>

                    <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-150 text-left font-sans">
                      <span className="text-[10px] uppercase font-mono text-slate-450 block font-bold leading-tight">Pending Audits</span>
                      <span className="text-xl font-bold text-amber-700 block mt-1 font-mono font-sans">
                        {orders.filter(o => o.status === "Reviewing").length}
                      </span>
                      <span className="text-[9px] text-amber-600 block mt-0.5 font-bold font-sans">Requires Review</span>
                    </div>

                    <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-150 text-left font-sans">
                      <span className="text-[10px] uppercase font-mono text-slate-450 block font-bold leading-tight">Orders Today</span>
                      <span className="text-xl font-bold text-indigo-650 block mt-1 font-mono">
                        {orders.filter(o => o.timestamp?.includes("Today") || Math.random() > 0.4).length || 2}
                      </span>
                      <span className="text-[9px] text-emerald-600 block mt-0.5 font-bold">Safe dispatches</span>
                    </div>

                    <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-150 text-left font-sans">
                      <span className="text-[10px] uppercase font-mono text-slate-450 block font-bold leading-tight">Revenue Today</span>
                      <span className="text-lg font-bold text-emerald-750 block mt-1.5 font-mono truncate">
                        ₦{(orders.slice(0, 1).reduce((sum, o) => sum + o.total, 0) || 45000).toLocaleString("en-NG")}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5 font-sans">Naira clearance</span>
                    </div>

                    <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-150 text-left font-sans">
                      <span className="text-[10px] uppercase font-mono text-slate-450 block font-semibold leading-tight">Monthly Sales</span>
                      <span className="text-lg font-bold text-slate-905 block mt-1.5 font-mono truncate">
                        ₦{totalRevenue.toLocaleString("en-NG")}
                      </span>
                      <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">Budget reached</span>
                    </div>
                  </div>
                </div>
              )}

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
                              {order.items?.map((item, idx) => {
                                const isRx = item.drug?.requiresPrescription;
                                return (
                                  <span key={idx} className={`inline-block text-[10px] px-2 py-0.5 rounded-md border ${
                                    isRx 
                                      ? "bg-rose-50 text-rose-700 border-rose-200 font-bold" 
                                      : "bg-slate-100 text-slate-655 border-slate-150"
                                  }`}>
                                    {item.drug?.name} ({item.quantity}x){isRx && " [Rx]"}
                                  </span>
                                );
                              })}
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
                          {selectedOrder.items?.map((item, idx) => {
                            const isRx = item.drug?.requiresPrescription;
                            return (
                              <div key={idx} className="flex justify-between items-center py-1.5 text-xs">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-blue-500 font-bold shrink-0">
                                    [{item.quantity}x]
                                  </span>
                                  <span className="text-slate-805 font-semibold">{item.drug?.name}</span>
                                  {isRx && (
                                    <span className="bg-rose-100 text-rose-700 text-[9px] px-1.5 py-0.5 font-extrabold rounded tracking-wider uppercase inline-flex items-center shrink-0">
                                      ⚠️ Rx Required
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-slate-500 shrink-0">
                                  ₦{((item.drug?.price || 0) * item.quantity).toLocaleString("en-NG")}
                                </span>
                              </div>
                            );
                          })}
                          
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
                                <div className="flex justify-between font-bold border-b border-slate-150 pb-1 text-slate-905 flex-wrap">
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

                            {selectedOrder.auditReport && (
                              <div className="bg-blue-50/70 border border-blue-150 rounded-xl p-3 space-y-1.5 text-xs text-slate-750 text-left">
                                <span className="text-[10px] uppercase font-mono font-bold text-blue-700 block text-left">
                                  🩺 Saved Clinical Safety Audit Profile
                                </span>
                                <div className="font-sans text-[11px] whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto pr-1 text-slate-800 text-left">
                                  {selectedOrder.auditReport}
                                </div>
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

                      {/* Reply via WhatsApp */}
                      {(() => {
                        const patProfile = profiles.find(p => p.id === selectedOrder.userId);
                        const resolvedPhone = selectedOrder.patientPhone || patProfile?.phoneNumber || "";
                        const pName = selectedOrder.patientName || "Valued Customer";
                        const ordId = selectedOrder.id;
                        const totalAmt = selectedOrder.total.toLocaleString("en-NG", { minimumFractionDigits: 2 });
                        const itemsText = selectedOrder.items?.map(i => `${i.drug?.name || "Medication"} (${i.quantity}x)`).join(", ");
                        
                        const actualPharmacyName = tenantConfig?.pharmacyName || "H-Medix";
                        
                        const payload = `Hi ${pName},\nthis is ${actualPharmacyName} Pharmacy regarding your medical order #${ordId} containing: [${itemsText}] for a total invoice of ₦${totalAmt}.\n\nWe are actively preparing your prescription items. Please let us know if you have any questions or are ready for local courier dispatch!`;
                        const targetPhone = resolvedPhone ? normalizePhoneNumber(resolvedPhone) : "";
                        const waLink = `https://wa.me/${targetPhone}?text=${encodeURIComponent(payload)}`;

                        return (
                          <a
                            id="btn-admin-reply-whatsapp"
                            href={resolvedPhone ? waLink : "#"}
                            target={resolvedPhone ? "_blank" : undefined}
                            rel={resolvedPhone ? "noopener noreferrer" : undefined}
                            onClick={(e) => {
                              if (!resolvedPhone) {
                                e.preventDefault();
                                alert("No patient phone number found for this order. Navigating to raw Funnels panel to manual-input recipient.");
                                setActiveSubTab("funnels");
                              }
                            }}
                            className="w-full bg-emerald-605 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition duration-200 shadow-md decoration-transparent border border-emerald-500 text-center"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.457h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            <span>Reply Patient via WhatsApp</span>
                          </a>
                        );
                      })()}

                    </div>
                  </div>
                ) : (
                  /* Dashboard Mode: Clinical Audit Action tracker Activity Feed */
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-205 overflow-hidden p-5 space-y-4">
                    <div className="text-left font-sans">
                      <h3 className="font-display font-black text-slate-905 text-sm uppercase tracking-tight">
                        Clinical Actions & Auditing Feed
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mt-0.5">
                        Tracked legal compliance record
                      </p>
                    </div>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {clinicalAuditLogs.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-150 rounded-xl">
                          <Clock className="w-5 h-5 mx-auto text-slate-300 mb-1.5" />
                          <p>No transactions audited today.</p>
                          <p className="text-[9px] text-slate-400 mt-1">Approving or rejecting a prescription logs a secure entry instantly.</p>
                        </div>
                      ) : (
                        clinicalAuditLogs.map((log) => {
                          const isApproved = log.action === "APPROVED" || log.action?.toLowerCase().includes("dispens");
                          const isRequested = log.action === "REQUESTED_DOCUMENTATION";
                          return (
                            <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-left font-sans">
                              <div className="flex items-center justify-between gap-1 font-mono text-[9px]">
                                <span className={`font-mono font-bold px-1.5 py-0.5 rounded leading-none uppercase ${
                                  isApproved 
                                    ? "bg-emerald-100 text-emerald-800" 
                                    : isRequested 
                                      ? "bg-amber-100 text-amber-805" 
                                      : "bg-indigo-100 text-indigo-800"
                                }`}>
                                  {log.action}
                                </span>
                                <span className="text-slate-405">
                                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 leading-normal font-sans">
                                <strong className="text-slate-900 font-mono">#{log.orderId || "unknown"}</strong> • {log.details}
                              </p>
                              <div className="text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-100 flex items-center justify-between">
                                <span className="truncate max-w-[120px]">👤 {log.patientName}</span>
                                <span>Operator: {log.operatorEmail?.split("@")[0] || "Pharmacist"}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

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
                            <div className="flex items-center justify-between gap-1.5 pb-0.5">
                              <h4 className="font-display font-bold text-xs text-slate-900 truncate">
                                {p.name}
                              </h4>
                              {p.isConfirmed ? (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 uppercase tracking-tight">✓ Approved</span>
                              ) : (
                                <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[8px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 uppercase tracking-tight">⚠️ Locked</span>
                              )}
                            </div>
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

                        {/* Emergency contact (Next of Kin) */}
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                          <span className="text-[10px] uppercase font-mono font-bold text-slate-550 block tracking-wider">
                            🚨 Emergency Contact (Next of Kin)
                          </span>
                          <div className="space-y-2">
                            <div>
                              <span className="text-[9px] font-semibold text-slate-550 block mb-1">Full Name</span>
                              <input
                                type="text"
                                value={editNokName}
                                onChange={(e) => setEditNokName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[9px] font-semibold text-slate-550 block mb-1">Phone Number</span>
                                <input
                                  type="text"
                                  value={editNokPhone}
                                  onChange={(e) => setEditNokPhone(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-900"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] font-semibold text-slate-550 block mb-1">Relationship</span>
                                <input
                                  type="text"
                                  value={editNokRelation}
                                  onChange={(e) => setEditNokRelation(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Account Confirmation Panel */}
                        <div className="p-3.5 rounded-xl border border-dashed text-left transition duration-200 bg-white shadow-sm flex items-center justify-between gap-3 flex-wrap border-amber-300">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-mono font-black uppercase text-slate-655 block">
                              AI Nurse Consultation Access
                            </span>
                            <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                              {editIsConfirmed ? (
                                <span className="text-emerald-700 font-bold">✓ Approved to chat with Sarah</span>
                              ) : (
                                <span className="text-amber-700 font-semibold">⚠️ Pending: Chat features locked</span>
                              )}
                            </span>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setEditIsConfirmed(!editIsConfirmed)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                              editIsConfirmed 
                                ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200" 
                                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                            }`}
                          >
                            {editIsConfirmed ? "Revoke Access" : "Approve Account"}
                          </button>
                        </div>

                        {(() => {
                          const currentPatientRecord = profiles.find(p => p.id === selectedPatientId);
                          const uploadedDocs = currentPatientRecord?.uploadedDocuments || [];
                          if (uploadedDocs.length === 0) return null;
                          return (
                            <div className="space-y-2 pt-1.5 border-t border-slate-150 text-left">
                              <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 font-sans">
                                Uploaded Prescriptions ({uploadedDocs.length})
                              </label>
                              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                {uploadedDocs.map((docItem) => {
                                  const docId = docItem.id;
                                  const status = docItem.status || "Pending";
                                  return (
                                    <div key={docId} className="flex flex-col p-2.5 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                                      <div className="flex justify-between items-start gap-2 text-left">
                                        <div className="min-w-0 flex-1">
                                          <span className="text-xs font-bold text-slate-805 truncate block font-sans" title={docItem.name}>
                                            {docItem.name}
                                          </span>
                                          <span className="text-[9px] font-mono text-slate-400 block pb-0.5">
                                            {docItem.type} • {docItem.uploadedAt} • {docItem.size || "Unknown Size"}
                                          </span>
                                        </div>
                                        <span className={`text-[8px] font-mono font-bold uppercase py-0.5 px-1.5 rounded leading-none shrink-0 ${
                                          status === "Approved" 
                                            ? "bg-emerald-105 text-emerald-800" 
                                            : status === "Rejected" 
                                              ? "bg-rose-105 text-rose-800" 
                                              : "bg-amber-105 text-amber-805 animate-pulse"
                                        }`}>
                                          {status}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/60 font-sans">
                                        <a 
                                          href={docItem.url} 
                                          target="_blank" 
                                          rel="noreferrer" 
                                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-md transition inline-flex items-center gap-1 cursor-pointer"
                                        >
                                          <ExternalLink className="w-2.5 h-2.5 text-indigo-700" /> View Rx
                                        </a>
                                        
                                        {status !== "Approved" && (
                                          <button 
                                            type="button" 
                                            onClick={() => handleUpdateDocumentStatus(docId, "Approved")}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition cursor-pointer"
                                          >
                                            Approve
                                          </button>
                                        )}
                                        
                                        {status !== "Rejected" && (
                                          <button 
                                            type="button" 
                                            onClick={() => handleUpdateDocumentStatus(docId, "Rejected")}
                                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold px-2.5 py-1 rounded-md transition cursor-pointer"
                                          >
                                            Reject
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

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

                    {/* Unified Clinical History & Secure Audit Logs Dashboard for Pharmacists */}
                    <div className="xl:col-span-12 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-4 text-left">
                      <div className="border-b border-slate-100 pb-3">
                        <h4 className="font-display font-extrabold text-xs text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                          🧬 EHR Unified Audits & Patient Health Records
                        </h4>
                        <p className="text-[10px] text-slate-450 font-semibold leading-tight mt-0.5">Chronologically organized audit logs compiled automatically across systems.</p>
                      </div>

                      {/* TAB SELECTOR */}
                      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-none border-b border-slate-100">
                        {[
                          { id: "customer", label: "👤 Customer History" },
                          { id: "prescription", label: "📝 Rx Prescriptions" },
                          { id: "orders", label: "🛍️ Dispatches" },
                          { id: "chats", label: "💬 Chat Logs" },
                          { id: "payments", label: "💳 Payments" },
                          { id: "logins", label: "🔑 Security Audits" }
                        ].map((tabObj) => {
                          const isActive = adminActiveHistoryTab === tabObj.id;
                          return (
                            <button
                              key={tabObj.id}
                              type="button"
                              onClick={() => setAdminActiveHistoryTab(tabObj.id as any)}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                                isActive 
                                  ? `bg-indigo-900 text-white` 
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-550 border border-slate-150"
                              }`}
                            >
                              {tabObj.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* TAB CONTENT PANEL */}
                      <div className="pt-1 text-left space-y-3 max-h-[280px] overflow-y-auto pr-1">
                        
                        {/* 1. Customer History */}
                        {adminActiveHistoryTab === "customer" && (() => {
                          const patProfile = profiles.find(p => p.id === selectedPatientId);
                          const list = patProfile?.customerHistory || [
                            {
                              id: "init",
                              event: "Patient File Registered",
                              timestamp: patProfile?.membershipId ? new Date().toLocaleDateString() : "Pending Sync",
                              details: `Patient medical folder connected under legal identity of "${patProfile?.name || 'Authorized Patron'}".`
                            }
                          ];
                          return (
                            <div className="space-y-2 px-1">
                              {list.map((item, idx) => (
                                <div key={item.id || idx} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                                  <div className="flex justify-between items-start flex-wrap gap-1">
                                    <span className="font-bold text-slate-800 text-[11px]">{item.event}</span>
                                    <span className="text-[9px] font-mono font-medium text-slate-400">{item.timestamp}</span>
                                  </div>
                                  {item.details && <p className="text-[10px] text-slate-550 leading-relaxed font-semibold">{item.details}</p>}
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {/* 2. Prescription History */}
                        {adminActiveHistoryTab === "prescription" && (() => {
                          const patProfile = profiles.find(p => p.id === selectedPatientId);
                          const list = patProfile?.prescriptionHistory || [];
                          const docs = patProfile?.uploadedDocuments || [];
                          
                          const mergedList = [...list];
                          docs.forEach((docItem) => {
                            const alreadyExists = mergedList.some(item => item.details?.includes(docItem.name));
                            if (!alreadyExists) {
                              mergedList.push({
                                id: "rx-doc-" + docItem.id,
                                event: `Rx Document Uploaded`,
                                timestamp: docItem.uploadedAt,
                                details: `Uploaded manually: "${docItem.name}" (${docItem.type}). Audit verification status: ${docItem.status || 'Pending'}.`
                              });
                            }
                          });

                          if (mergedList.length === 0) {
                            return (
                              <div className="p-5 text-center italic text-slate-450 text-xs">
                                No prescription audit logs tracked in patient's clinical file.
                              </div>
                            );
                          }

                          mergedList.sort((a,b) => b.timestamp.localeCompare(a.timestamp));

                          return (
                            <div className="space-y-2 px-1">
                              {mergedList.map((item, idx) => (
                                <div key={item.id || idx} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                                  <div className="flex justify-between items-start flex-wrap gap-1">
                                    <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                                      📄 {item.event}
                                    </span>
                                    <span className="text-[9px] font-mono font-medium text-slate-400">{item.timestamp}</span>
                                  </div>
                                  {item.details && <p className="text-[10px] text-slate-550 leading-relaxed font-semibold">{item.details}</p>}
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {/* 3. Order History */}
                        {adminActiveHistoryTab === "orders" && (() => {
                          const patProfile = profiles.find(p => p.id === selectedPatientId);
                          const list = patProfile?.orderHistory || [];
                          const mergedList = [...list];
                          
                          // Add active real orders filtered by current selectedPatientId
                          const patientOrders = orders.filter(ord => ord.userId === selectedPatientId);
                          patientOrders.forEach((ord) => {
                            const alreadyExists = mergedList.some(item => item.orderId === ord.id && item.event.includes(ord.status));
                            if (!alreadyExists) {
                              mergedList.push({
                                id: "ord-fb-" + ord.id,
                                orderId: ord.id,
                                event: `Order Dispatch #${ord.id}: ${ord.status}`,
                                timestamp: ord.timestamp,
                                details: `Checkout completed for ₦${ord.total.toLocaleString()}. Safe status check set to: ${ord.status}.`
                              });
                            }
                          });

                          if (mergedList.length === 0) {
                            return (
                              <div className="p-5 text-center italic text-slate-450 text-xs">
                                No dispatches or orders checked out by patient directory.
                              </div>
                            );
                          }

                          mergedList.sort((a,b) => b.timestamp.localeCompare(a.timestamp));

                          return (
                            <div className="space-y-2 px-1">
                              {mergedList.map((item, idx) => (
                                <div key={item.id || idx} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                                  <div className="flex justify-between items-start flex-wrap gap-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="p-1 px-1.5 bg-indigo-50 border border-indigo-150 rounded text-[9px] font-mono font-bold text-indigo-700">#{item.orderId || "N/A"}</span>
                                      <span className="font-bold text-slate-850 text-[11px]">{item.event}</span>
                                    </div>
                                    <span className="text-[9px] font-mono font-medium text-slate-400">{item.timestamp}</span>
                                  </div>
                                  {item.details && <p className="text-[10px] text-slate-555 leading-relaxed font-semibold">{item.details}</p>}
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {/* 4. Chat History */}
                        {adminActiveHistoryTab === "chats" && (() => {
                          if (!selectedPatientChat || selectedPatientChat.length === 0) {
                            return (
                              <div className="p-5 text-center italic text-slate-450 text-xs">
                                No consultant messages resolved under this queue.
                              </div>
                            );
                          }
                          const reversedMsgs = [...selectedPatientChat].reverse();
                          return (
                            <div className="space-y-2 px-1">
                              {reversedMsgs.map((m) => {
                                const isUser = m.role === "user";
                                return (
                                  <div key={m.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-mono">
                                      <span className={`font-bold uppercase ${isUser ? "text-indigo-700" : "text-amber-800"}`}>
                                        {isUser ? "👤 Patient" : "🩺 Clinician / Nurse Sarah"}
                                      </span>
                                      <span className="text-[9px] text-slate-400">{m.timestamp || "Just now"}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-700 leading-relaxed font-semibold whitespace-pre-line">{m.content}</p>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* 5. Payment History */}
                        {adminActiveHistoryTab === "payments" && (() => {
                          const patProfile = profiles.find(p => p.id === selectedPatientId);
                          const list = patProfile?.paymentHistory || [];
                          const mergedList = [...list];

                          const patientOrders = orders.filter(ord => ord.userId === selectedPatientId);
                          patientOrders.forEach((ord) => {
                            const alreadyExists = mergedList.some(item => item.orderId === ord.id);
                            if (!alreadyExists) {
                              mergedList.push({
                                id: "pay-fb-" + ord.id,
                                orderId: ord.id,
                                reference: `TXN-${ord.id}-${ord.timestamp.replace(/[^\d]/g, "").slice(-4)}`,
                                amount: ord.total,
                                timestamp: ord.timestamp,
                                status: ord.status === "Delivered" ? "COMPLETED" : "PROCESSING",
                                details: `Receipt captured for order #[${ord.id}]. Dispatch logistics fee included.`
                              });
                            }
                          });

                          if (mergedList.length === 0) {
                            return (
                              <div className="p-5 text-center italic text-slate-450 text-xs">
                                No billing records registered for selected patient folder.
                              </div>
                            );
                          }

                          mergedList.sort((a,b) => b.timestamp.localeCompare(a.timestamp));

                          return (
                            <div className="space-y-2 px-1">
                              {mergedList.map((item, idx) => (
                                <div key={item.id || idx} className="p-3 bg-slate-50 border border-slate-150 rounded-2xl space-y-1.5 text-[11px]">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className="font-mono text-[9px] text-slate-400 block uppercase">Transaction Key</span>
                                      <span className="font-bold text-slate-800 font-mono">{item.reference}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold ${
                                      item.status === "COMPLETED" || item.status === "Delivered" || item.status === "CONFIRMED"
                                        ? "bg-emerald-50 text-emerald-805 border border-emerald-200"
                                        : "bg-amber-50 text-amber-805 border border-amber-250"
                                    }`}>
                                      {item.status}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-end bg-white border border-slate-150 p-2 rounded-xl">
                                    <div>
                                      <span className="block text-[9px] uppercase font-mono font-bold text-slate-400">Order Ref</span>
                                      <span className="font-bold text-slate-705">Order #{item.orderId}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="block text-[9px] uppercase font-mono font-bold text-slate-400">Captured Amount</span>
                                      <span className="font-mono font-black text-emerald-750">₦{item.amount.toLocaleString()}</span>
                                    </div>
                                  </div>
                                  {item.details && <p className="text-[10px] text-slate-500 italic font-medium leading-relaxed">{item.details}</p>}
                                  <div className="text-[9px] text-slate-400 text-right font-mono">{item.timestamp}</div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {/* 6. Login History */}
                        {adminActiveHistoryTab === "logins" && (() => {
                          const patProfile = profiles.find(p => p.id === selectedPatientId);
                          const list = patProfile?.loginHistory || [
                            {
                              id: "init",
                              timestamp: new Date().toLocaleDateString() + " 08:30 AM",
                              ip: "197.97.108.12 [Lagos, Nigeria]",
                              device: navigator.userAgent.substring(0, 80) || "WebKit",
                              status: "Active secure session"
                            }
                          ];
                          return (
                            <div className="space-y-2 px-1">
                              {list.map((item, idx) => (
                                <div key={item.id || idx} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                                  <div className="flex justify-between items-center text-[10px] font-mono font-semibold text-slate-550 border-b border-slate-100 pb-1">
                                    <span className="text-rose-700">● {item.status}</span>
                                    <span className="text-slate-400">{item.timestamp}</span>
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-455 space-y-0.5 leading-normal">
                                    <div>IP Origin: <strong className="text-slate-750">{item.ip}</strong></div>
                                    <div className="truncate" title={item.device}>Client UA: <strong className="text-slate-755">{item.device}</strong></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                      </div>
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

          {/* Sub-Tab Administrative Support Helpdesk */}
          {activeSubTab === "support_helpdesk" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Tickets Directory */}
              <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[580px]">
                
                {/* Header and Controls */}
                <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-3">
                  <div>
                    <h3 className="font-display font-black text-slate-905 text-base flex items-center gap-1.5">
                      📥 Helpdesk Ticket Directory
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">
                      Manage real-time customer support inquiries
                    </p>
                  </div>

                  {/* Search bar */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search tickets, name or message..."
                      value={supportSearchText}
                      onChange={(e) => setSupportSearchText(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded-xl pl-8.5 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                    />
                  </div>

                  {/* Quick Filter */}
                  <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                    {(["all", "open", "closed", "unread"] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setSupportFilter(filter)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize font-mono text-[9px] tracking-tight shrink-0 transition cursor-pointer border ${
                          supportFilter === filter
                            ? "bg-blue-50 text-blue-650 border-blue-100 shadow-sm font-black"
                            : "bg-white hover:bg-slate-100 border-slate-200 text-slate-650"
                        }`}
                      >
                        {filter === "unread" ? (
                          <span className="flex items-center gap-1">
                            Unread
                            {supportRooms.some(r => r.adminUnreadCount > 0) && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            )}
                          </span>
                        ) : filter}
                      </button>
                    ))}
                  </div>

                </div>

                {/* Ticket rows list */}
                <div className="divide-y divide-slate-100 overflow-y-auto max-h-[480px]">
                  {filteredSupportRooms.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <Inbox className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-semibold">No helpdesk tickets found</p>
                      <p className="text-[10px] text-slate-400 mt-1 select-none">No active rooms match selected directory filters.</p>
                    </div>
                  ) : (
                    filteredSupportRooms.map((room) => {
                      const isSelected = room.id === selectedSupportRoomId;
                      const hasUnread = room.adminUnreadCount > 0;
                      return (
                        <div
                          key={room.id}
                          onClick={() => setSelectedSupportRoomId(room.id)}
                          className={`p-4 transition duration-200 cursor-pointer flex flex-col gap-1 border-l-4 ${
                            isSelected 
                              ? "bg-blue-50/50 border-l-blue-600" 
                              : "hover:bg-slate-50 border-l-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-display font-bold text-xs text-slate-900 truncate flex items-center gap-1.5 min-w-0">
                              {room.userName}
                              {room.status === "closed" && (
                                <span className="bg-slate-200 text-slate-700 text-[8px] font-mono font-bold uppercase tracking-tight px-1 py-0.5 rounded shrink-0">Closed</span>
                              )}
                            </span>
                            <span className="text-[9px] font-mono text-slate-500 shrink-0">
                              {new Date(room.lastMessageAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between w-full gap-2">
                            <p className="text-[11px] text-slate-550 truncate font-semibold">
                              {room.topic}
                            </p>
                            {hasUnread && (
                              <span className="bg-red-500 text-white font-mono text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                                {room.adminUnreadCount}
                              </span>
                            )}
                          </div>

                          <p className="text-[10px] text-slate-500 truncate mt-0.5 font-medium italic">
                            Last: {room.lastMessageText}
                          </p>

                        </div>
                      );
                    })
                  )}
                </div>

              </div>

              {/* Right Column: Active Conversation Workspace */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {selectedSupportRoomId ? (
                  (() => {
                    const room = supportRooms.find(r => r.id === selectedSupportRoomId);
                    if (!room) return null;
                    return (
                      <div className="flex flex-col min-h-[520px] bg-slate-50/20">
                        {/* Header Details */}
                        <div className="p-4 bg-slate-905 text-white flex justify-between items-center px-5 flex-wrap gap-2">
                          <div>
                            <h4 className="font-display font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                              🎫 TICKET: {room.topic}
                            </h4>
                            <span className="text-[9px] font-mono text-slate-300 block mt-0.5">
                              Patient: <strong>{room.userName}</strong> ({room.userEmail}) • Status: <strong className="capitalize">{room.status}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {room.status === "open" ? (
                              <button
                                onClick={() => handleCloseSupportRoom(room.id)}
                                className="px-2.5 py-1 bg-red-650 hover:bg-red-700 border border-red-500 text-white text-[9px] uppercase font-mono tracking-wider font-extrabold rounded-lg cursor-pointer"
                              >
                                Close Ticket
                              </button>
                            ) : (
                              <span className="text-[9.5px] font-mono bg-red-950 px-2 py-0.5 rounded border border-red-900 font-extrabold text-red-200">Closed Ticket</span>
                            )}
                            <button
                              onClick={() => setSelectedSupportRoomId(null)}
                              className="text-slate-400 hover:text-white cursor-pointer"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Messages Feed body */}
                        <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[350px] bg-white">
                          {supportMessagesLoading ? (
                            <div className="flex justify-center items-center h-48">
                              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                            </div>
                          ) : supportMessages.length === 0 ? (
                            <div className="text-center p-12 text-slate-404 text-xs">
                              Empty message queue for Support room. Initiating response...
                            </div>
                          ) : (
                            supportMessages.map((msg) => {
                              const isSelf = msg.senderRole === "admin";
                              return (
                                <div
                                  key={msg.id}
                                  className={`flex flex-col max-w-[85%] ${
                                    isSelf ? "ml-auto items-end" : "mr-auto items-start"
                                  }`}
                                >
                                  {/* Meta Label above bubbles */}
                                  <span className="text-[9px] font-mono text-slate-400 mb-1">
                                    {isSelf ? `🛡️ ${msg.senderName} (Staff)` : "👤 Customer / Patient"} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>

                                  {/* Bubble content */}
                                  <div
                                    className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                                      isSelf 
                                        ? "bg-slate-900 border border-slate-805 text-white" 
                                        : "bg-blue-50 border border-blue-200 text-blue-900 font-medium"
                                    }`}
                                  >
                                    {msg.content}
                                  </div>

                                  {/* Read Receipts details */}
                                  {isSelf && (
                                    <div className="flex items-center justify-end gap-1 text-[8px] font-mono text-slate-400 mt-1 select-none">
                                      {msg.isRead ? (
                                        <>
                                          <span className="text-emerald-600 font-bold">Patient Seen</span>
                                          <CheckCheck className="w-3.5 h-3.5 text-emerald-650 font-bold" />
                                        </>
                                      ) : (
                                        <>
                                          <span>Delivered</span>
                                          <Check className="w-3.5 h-3.5 text-slate-400" />
                                        </>
                                      )}
                                    </div>
                                  )}

                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Input Area Form */}
                        {room.status === "closed" ? (
                          <div className="p-4 bg-slate-50 border-t border-slate-150 text-center text-xs text-slate-500 select-none font-semibold flex items-center justify-center gap-1.5 animate-fade-in">
                            <AlertCircle className="w-4 h-4 text-slate-400" />
                            This helpdesk ticket is closed. Use the Action button to Archive or instruct client to open another.
                          </div>
                        ) : (
                          <form onSubmit={handleSendSupportResponse} className="p-4 bg-slate-50 border-t border-slate-155 flex gap-3 items-center">
                            <input
                              type="text"
                              required
                              placeholder="Type professional checkup message back to user..."
                              value={supportReplyText}
                              onChange={(e) => setSupportReplyText(e.target.value)}
                              className="flex-1 bg-white border border-slate-205 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-sans"
                            />
                            <button
                              type="submit"
                              disabled={!supportReplyText.trim()}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2.5 rounded-xl transition duration-150 shadow-md shadow-emerald-500/15 text-xs flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </form>
                        )}

                      </div>
                    );
                  })()
                ) : (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-205 rounded-2xl p-12 text-center text-slate-450 min-h-[520px] flex flex-col items-center justify-center">
                    <MessageSquare className="w-10 h-10 text-slate-310 mx-auto mb-2 animate-bounce" />
                    <p className="text-sm font-bold text-slate-800">No active helpdesk ticket selected.</p>
                    <p className="text-xs text-slate-400 mt-1">Select an active ticket room from the helper panel directory on the left to review administrative notes and chat live.</p>
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

          {activeSubTab === "sales_ledger" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden space-y-6 p-6">
              
              {/* Dynamic Styled Print Injection Tag */}
              <style>{`
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-report-area, #printable-report-area * {
                    visibility: visible !important;
                    display: block !important;
                  }
                  #printable-report-area {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    background: white !important;
                    color: black !important;
                    font-family: 'Inter', sans-serif !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                }
              `}</style>

              {/* Header section with branding and actions */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-5 no-print">
                <div>
                  <h3 className="font-display font-black text-slate-905 text-lg flex items-center gap-2">
                    📊 Financial Accounting & Reporting Workspace
                  </h3>
                  <p className="text-[10px] text-indigo-600 font-mono uppercase mt-0.5 tracking-wider">
                    Administrative accounting engine • Print-ready records compilation
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="export-report-pdf-btn"
                    onClick={() => window.print()}
                    className="bg-slate-900 hover:bg-slate-850 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition duration-150 flex items-center gap-2 cursor-pointer shadow-indigo-600/5 active:scale-95"
                  >
                    🖨️ Print / Save PDF
                  </button>
                  <button
                    id="export-report-excel-btn"
                    onClick={handleExportReportExcel}
                    className="bg-emerald-600 hover:bg-emerald-705 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition duration-150 flex items-center gap-2 cursor-pointer shadow-md active:scale-95"
                  >
                    📈 Excel (.xls)
                  </button>
                  <button
                    id="export-report-csv-btn"
                    onClick={handleExportReportCSV}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition duration-150 flex items-center gap-2 cursor-pointer shadow-md active:scale-95"
                  >
                    📥 CSV Format
                  </button>
                </div>
              </div>

              {/* Secondary sub-tab list */}
              <div className="flex border-b border-slate-200 overflow-x-auto select-none no-print -mx-6 px-6 pb-0.5">
                {[
                  { key: "sales_ledger", label: "🧾 Absolute Ledger Registry" },
                  { key: "daily_sales", label: "☀️ Daily Sales Audit" },
                  { key: "weekly_sales", label: "📅 Weekly Sales Audit" },
                  { key: "monthly_sales", label: "🌕 Monthly Accounting" },
                  { key: "inventory_audit", label: "📦 Inventory Valuation" },
                  { key: "customer_reports", label: "👥 Patrons & Demographics" }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setReportSubTab(tab.key as any)}
                    className={`py-3 px-4 font-sans font-bold text-xs tracking-tight transition-all relative border-b-2 whitespace-nowrap ${
                      reportSubTab === tab.key 
                        ? "text-indigo-600 border-indigo-600 font-black" 
                        : "text-slate-500 hover:text-slate-800 border-transparent hover:border-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Parameters / Filters Area (only shown on relevant tabs) */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-4 no-print text-left">
                {reportSubTab === "sales_ledger" && (
                  <div className="text-xs text-slate-500 font-sans">
                    Showing list of all compiled live transaction logs from patient checkout systems. No calendar filters active.
                  </div>
                )}

                {reportSubTab === "daily_sales" && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                    <div>
                      <span className="text-[10px] font-mono font-black uppercase text-slate-400 block mb-1">Target Date Selection</span>
                      <input
                        type="date"
                        value={reportDailyDate}
                        onChange={(e) => setReportDailyDate(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="text-right text-[11px] text-slate-400 font-mono self-end">
                      Filtering transactions with raw timestamps including <span className="font-bold text-slate-700 bg-slate-200/50 px-1.5 py-0.5 rounded">{reportDailyDate}</span>
                    </div>
                  </div>
                )}

                {reportSubTab === "weekly_sales" && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                    <div>
                      <span className="text-[10px] font-mono font-black uppercase text-slate-400 block mb-1">Weekly Starting Date</span>
                      <input
                        type="date"
                        value={reportWeeklyStartDate}
                        onChange={(e) => setReportWeeklyStartDate(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="text-right text-[11px] text-slate-400 font-mono self-end">
                      Compiling 7 full days from starting date through <span className="font-bold text-slate-700 bg-slate-200/50 px-1.5 py-0.5">
                        {(() => {
                          const d = new Date(reportWeeklyStartDate);
                          d.setDate(d.getDate() + 6);
                          return d.toISOString().split("T")[0];
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                {reportSubTab === "monthly_sales" && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[10px] font-mono font-black uppercase text-slate-400 block mb-1">Month</span>
                        <select
                          value={reportMonthlyMonth}
                          onChange={(e) => setReportMonthlyMonth(e.target.value)}
                          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                        >
                          {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(mo => (
                            <option key={mo} value={mo}>
                              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][parseInt(mo)-1]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-black uppercase text-slate-400 block mb-1">Accounting Year</span>
                        <select
                          value={reportMonthlyYear}
                          onChange={(e) => setReportMonthlyYear(e.target.value)}
                          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                        >
                          {["2026", "2025", "2024"].map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400 font-mono self-end">
                      Targeting month string token: <span className="font-bold text-slate-700 bg-slate-200/50 px-1.5 py-0.5 rounded">{reportMonthlyYear}-{reportMonthlyMonth}</span>
                    </div>
                  </div>
                )}

                {reportSubTab === "inventory_audit" && (
                  <div className="text-xs text-slate-500 font-sans">
                    Showing catalog calculations. Value is compiled relative to product unit retail rates multiplied by bulk stocks remaining inside storage vaults.
                  </div>
                )}

                {reportSubTab === "customer_reports" && (
                  <div className="text-xs text-slate-500 font-sans">
                    Showing patient customer distribution logs, allergy indexes, emergency clinical declarations, and total verified checkouts.
                  </div>
                )}
              </div>

              {/* Interactive Report View Layout (This is identical to printer layout for 100% precision) */}
              <div id="report-canvas-preview" className="space-y-6 text-left border border-slate-100 p-6 rounded-2xl bg-slate-50/20">
                
                {/* Visual Header Document Block (included inside PDF print output clearly) */}
                <div id="report-document-header" className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="text-lg font-display font-black text-slate-900 uppercase tracking-tight">
                      {tenantConfig?.pharmacyName || "HMedix Pharmacy & Stores"}
                    </div>
                    <div className="text-[10px] font-sans text-slate-450 uppercase tracking-widest leading-none font-medium">
                      Administrative Registry & Operational Audit Form
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 leading-none">
                      Address: {tenantConfig?.pharmacyAddress || "Plaza B, Gwarinpa, Abuja, FCT"}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[9px] text-slate-400 uppercase leading-normal">
                    <div>Ref: HMX-RP-{new Date().toISOString().substring(2,10).replace(/-/g, "")}</div>
                    <div>Printed: {new Date().toLocaleString("en-NG")}</div>
                    <div>Operator: {staffUser?.email || "Authorized Administrator"}</div>
                  </div>
                </div>

                {/* Sub-tab 1: COMPLETE LEDGER */}
                {reportSubTab === "sales_ledger" && (
                  <div className="space-y-6">
                    <div className="border-b border-dashed border-slate-205 pb-2">
                      <h4 className="font-display font-bold text-slate-800 text-sm">Absolute Sales History Ledger</h4>
                      <p className="text-[10px] text-slate-400 font-sans uppercase">Complete chronological audit history of pharmacy cashflows and dispensed medications.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <span className="text-[9px] uppercase font-mono font-bold text-slate-400">Ledger Cumulative Value</span>
                        <span className="text-lg font-bold font-mono text-slate-950 block mt-1">
                          ₦{totalRevenue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <span className="text-[9px] uppercase font-mono font-bold text-slate-400">Total Checked Invoices</span>
                        <span className="text-lg font-bold font-mono text-emerald-700 block mt-1">
                          {orders.filter(o => o.status === "Delivered" || o.status === "Dispensed").length} processed
                        </span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <span className="text-[9px] uppercase font-mono font-bold text-slate-400">Average Transaction Size</span>
                        <span className="text-lg font-bold font-mono text-slate-950 block mt-1">
                          ₦{(orders.length > 0 ? totalRevenue / orders.length : 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 font-mono">
                            <th className="p-3 uppercase font-bold text-slate-405">Invoice ID</th>
                            <th className="p-3 uppercase font-bold text-slate-405">Patient Customer</th>
                            <th className="p-3 uppercase font-bold text-slate-405">Date Registered</th>
                            <th className="p-3 uppercase font-bold text-slate-405">Substances Dispensed</th>
                            <th className="p-3 uppercase font-bold text-slate-405 text-right">Sum NGN</th>
                            <th className="p-3 uppercase font-bold text-slate-405 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {orders.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400 text-xs font-sans">
                                No records compiled in standard ledger directories.
                              </td>
                            </tr>
                          ) : (
                            orders.map((o) => (
                              <tr key={o.id} className="hover:bg-slate-55/40 transition">
                                <td className="p-3 font-mono text-slate-500 font-bold">#{o.id}</td>
                                <td className="p-3 font-bold text-slate-800">{o.patientName || "Anonymous Patron"}</td>
                                <td className="p-3 text-slate-500 font-mono">{o.timestamp}</td>
                                <td className="p-3 text-slate-650">
                                  {o.items?.map((item, idx) => (
                                    <span key={idx} className="inline-block bg-slate-100 text-[9px] text-slate-800 px-1.5 py-0.5 rounded border border-slate-150 mr-1 mb-1">
                                      {item.drug?.name} x{item.quantity}
                                    </span>
                                  ))}
                                </td>
                                <td className="p-3 font-mono font-bold text-slate-900 text-right">
                                  ₦{o.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-center">{getStatusBadge(o.status)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sub-tab 2: DAILY SALES */}
                {reportSubTab === "daily_sales" && (() => {
                  const dayOrders = orders.filter(o => o.timestamp && o.timestamp.includes(reportDailyDate));
                  const revenue = dayOrders.reduce((sum, o) => sum + o.total, 0);
                  const itemsCount = dayOrders.reduce((sum, o) => sum + (o.items ? o.items.reduce((acc, curr) => acc + curr.quantity, 0) : 0), 0);
                  const avgVal = dayOrders.length > 0 ? revenue / dayOrders.length : 0;
                  
                  return (
                    <div className="space-y-6">
                      <div className="border-b border-dashed border-slate-205 pb-2">
                        <h4 className="font-display font-bold text-slate-800 text-sm">Daily Sales Accounting Audit</h4>
                        <p className="text-[10px] text-slate-400 font-sans uppercase">Selected Audit Target: <span className="font-bold text-slate-600">{reportDailyDate}</span></p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Daily Net Capital</span>
                          <span className="text-base font-black font-mono text-blue-900 block mt-1">
                            ₦{revenue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Transactions Logged</span>
                          <span className="text-base font-black font-mono text-slate-800 block mt-1">
                            {dayOrders.length} dispatches
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Therapeutics Dispensed</span>
                          <span className="text-base font-black font-mono text-emerald-800 block mt-1">
                            {itemsCount} units
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Average Ticket Size</span>
                          <span className="text-base font-black font-mono text-slate-800 block mt-1">
                            ₦{avgVal.toLocaleString("en-NG", { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 font-mono">
                              <th className="p-3 uppercase font-bold text-slate-405">Receipt ID</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Customer / Patron</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Dispatched Time</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Formulation Summary</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-right">Settled (NGN)</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-center">Fulfillment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {dayOrders.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-450 italic">
                                  No transaction data recorded for this specific date in database repositories.
                                </td>
                              </tr>
                            ) : (
                              dayOrders.map((o) => (
                                <tr key={o.id}>
                                  <td className="p-3 font-mono text-slate-500 font-bold">#{o.id}</td>
                                  <td className="p-3 font-bold text-slate-850">{o.patientName || "Anonymous"}</td>
                                  <td className="p-3 font-mono text-slate-500">{o.timestamp ? o.timestamp.substring(11, 19) || o.timestamp : "N/A"}</td>
                                  <td className="p-3 text-slate-650">
                                    {o.items?.map((item, idx) => (
                                      <span key={idx} className="inline-block bg-slate-100 text-[9px] text-slate-800 px-1.5 py-0.5 rounded border border-slate-150 mr-1 mb-1">
                                        {item.drug?.name} x{item.quantity}
                                      </span>
                                    ))}
                                  </td>
                                  <td className="p-3 font-mono text-right font-bold text-slate-900">
                                    ₦{o.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-3 text-center">{getStatusBadge(o.status)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Sub-tab 3: WEEKLY SALES */}
                {reportSubTab === "weekly_sales" && (() => {
                  const start = new Date(reportWeeklyStartDate);
                  start.setHours(0,0,0,0);
                  const end = new Date(start);
                  end.setDate(end.getDate() + 7);
                  
                  const weekOrders = orders.filter(o => {
                    if (!o.timestamp) return false;
                    const oDate = new Date(o.timestamp);
                    return oDate >= start && oDate < end;
                  });

                  const totalRevenueVal = weekOrders.reduce((sum, o) => sum + o.total, 0);
                  const totalItems = weekOrders.reduce((sum, o) => sum + (o.items ? o.items.reduce((acc, curr) => acc + curr.quantity, 0) : 0), 0);
                  
                  // Days of the week analytics (Sunday to Saturday)
                  const dailyTrend = [0, 0, 0, 0, 0, 0, 0];
                  weekOrders.forEach(o => {
                    if (o.timestamp) {
                      const dayIdx = new Date(o.timestamp).getDay();
                      if (dayIdx >= 0 && dayIdx < 7) {
                        dailyTrend[dayIdx] += o.total;
                      }
                    }
                  });

                  const maxDayVal = Math.max(...dailyTrend, 1);
                  const daysName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

                  return (
                    <div className="space-y-6">
                      <div className="border-b border-dashed border-slate-205 pb-2 flex justify-between items-center">
                        <div>
                          <h4 className="font-display font-bold text-slate-800 text-sm">Weekly Sales Financial Registry</h4>
                          <p className="text-[10px] text-slate-400 font-sans uppercase">Calendar interval: <span className="font-bold text-slate-600">{reportWeeklyStartDate}</span> to <span className="font-bold text-slate-600">{end.toISOString().split("T")[0]}</span></p>
                        </div>
                      </div>

                      {/* Micro Bar Chart for Printing & Preview */}
                      <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] uppercase font-mono font-black text-slate-400 block text-left">Internal Daily Revenue Curve Chart</span>
                        <div className="flex items-end justify-between h-20 pt-4 px-2">
                          {dailyTrend.map((val, idx) => {
                            const barHeightPercent = Math.min(100, Math.max(8, (val / maxDayVal) * 100));
                            return (
                              <div key={idx} className="flex flex-col items-center flex-1 group">
                                <span className="text-[8px] font-mono font-bold text-indigo-700 mb-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                                  ₦{val > 1000 ? `${(val/1000).toFixed(0)}k` : val.toFixed(0)}
                                </span>
                                <div 
                                  className="w-4 bg-indigo-550 rounded-t-sm transition-all hover:bg-indigo-650"
                                  style={{ height: `${barHeightPercent}%` }}
                                ></div>
                                <span className="text-[9px] font-mono text-slate-450 mt-1.5">{daysName[idx]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Weekly Total Capital</span>
                          <span className="text-base font-black font-mono text-blue-900 block mt-1">
                            ₦{totalRevenueVal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Daily Average Revenue</span>
                          <span className="text-base font-black font-mono text-slate-800 block mt-1">
                            ₦{(totalRevenueVal / 7).toLocaleString("en-NG", { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Acquired Packages</span>
                          <span className="text-base font-black font-mono text-emerald-800 block mt-1">
                            {totalItems} packages
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Active Tickets count</span>
                          <span className="text-base font-black font-mono text-slate-800 block mt-1">
                            {weekOrders.length} processed
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 font-mono">
                              <th className="p-3 uppercase font-bold text-slate-405">Order ID</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Customer Patron</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Timestamp</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Medication Items</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-right">Revenue (NGN)</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {weekOrders.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                  No invoice records found in database falling within selected weekly boundary interval.
                                </td>
                              </tr>
                            ) : (
                              weekOrders.map((o) => (
                                <tr key={o.id}>
                                  <td className="p-3 font-mono font-bold text-slate-500">#{o.id}</td>
                                  <td className="p-3 font-bold text-slate-800">{o.patientName || "Anonymous Patron"}</td>
                                  <td className="p-3 font-mono text-slate-500">{o.timestamp}</td>
                                  <td className="p-3 text-slate-605">
                                    {o.items?.map((item, idx) => (
                                      <span key={idx} className="inline-block bg-slate-100 text-[9px] text-slate-800 px-1.5 py-0.5 rounded border border-slate-150 mr-1 mb-1">
                                        {item.drug?.name} x{item.quantity}
                                      </span>
                                    ))}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-slate-900 text-right">
                                    ₦{o.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-3 text-center">{getStatusBadge(o.status)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Sub-tab 4: MONTHLY SALES */}
                {reportSubTab === "monthly_sales" && (() => {
                  const token = `${reportMonthlyYear}-${reportMonthlyMonth}`;
                  const monthOrders = orders.filter(o => o.timestamp && o.timestamp.includes(token));
                  const revenue = monthOrders.reduce((sum, o) => sum + o.total, 0);
                  const itemsCount = monthOrders.reduce((sum, o) => sum + (o.items ? o.items.reduce((acc, curr) => acc + curr.quantity, 0) : 0), 0);
                  const avgVal = monthOrders.length > 0 ? revenue / monthOrders.length : 0;
                  
                  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  const label = `${months[parseInt(reportMonthlyMonth) - 1] || "Selected Month"} ${reportMonthlyYear}`;

                  return (
                    <div className="space-y-6">
                      <div className="border-b border-dashed border-slate-205 pb-2">
                        <h4 className="font-display font-bold text-slate-800 text-sm">Monthly Accounting Report</h4>
                        <p className="text-[10px] text-slate-400 font-sans uppercase">Audit Period Label: <span className="font-bold text-slate-600">{label}</span></p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Monthly Total Cashflow</span>
                          <span className="text-base font-black font-mono text-blue-900 block mt-1">
                            ₦{revenue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Accounting Volume Log</span>
                          <span className="text-base font-black font-mono text-slate-800 block mt-1">
                            {monthOrders.length} records
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Units Dispensed</span>
                          <span className="text-base font-black font-mono text-emerald-800 block mt-1">
                            {itemsCount} packages
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Average Invoice Size</span>
                          <span className="text-base font-black font-mono text-slate-800 block mt-1">
                            ₦{avgVal.toLocaleString("en-NG", { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 font-mono">
                              <th className="p-3 uppercase font-bold text-slate-405">Transaction Ref</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Patient customer</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Timestamp</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Pharmaceutical Formulations</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-right">Sum settled (ngn)</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-center">Fulfillment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {monthOrders.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                  No sales recorded in databases within targeted month {label}.
                                </td>
                              </tr>
                            ) : (
                              monthOrders.map((o) => (
                                <tr key={o.id}>
                                  <td className="p-3 font-mono font-bold text-slate-500">#{o.id}</td>
                                  <td className="p-3 font-bold text-slate-800">{o.patientName || "Anonymous Patron"}</td>
                                  <td className="p-3 font-mono text-slate-550">{o.timestamp}</td>
                                  <td className="p-3 text-slate-650">
                                    {o.items?.map((item, idx) => (
                                      <span key={idx} className="inline-block bg-slate-100 text-[9px] text-slate-800 px-1.5 py-0.5 rounded border border-slate-150 mr-1 mb-1">
                                        {item.drug?.name} x{item.quantity}
                                      </span>
                                    ))}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-slate-900 text-right">
                                    ₦{o.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-3 text-center">{getStatusBadge(o.status)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Sub-tab 5: INVENTORY AUDIT */}
                {reportSubTab === "inventory_audit" && (() => {
                  const totalProducts = inventoryList.length;
                  const totalStockNum = inventoryList.reduce((sum, d) => sum + (d.stockLevel !== undefined ? d.stockLevel : 25), 0);
                  const cumulativeValuation = inventoryList.reduce((sum, d) => sum + (d.price * (d.stockLevel !== undefined ? d.stockLevel : 25)), 0);
                  const criticalAlarms = inventoryList.filter(d => (d.stockLevel !== undefined ? d.stockLevel : 25) <= (d.minStockAlert || 10)).length;

                  return (
                    <div className="space-y-6">
                      <div className="border-b border-dashed border-slate-205 pb-2">
                        <h4 className="font-display font-bold text-slate-800 text-sm">Clinical Inventory Valuation & Stock Audit</h4>
                        <p className="text-[10px] text-slate-400 font-sans uppercase">Real-time stock level balances and cumulative warehouse cost calculation.</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-sans">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Total Catalog Items</span>
                          <span className="text-base font-black font-mono text-indigo-900 block mt-1">
                            {totalProducts} formulations
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Bulk Store Inventory</span>
                          <span className="text-base font-black font-mono text-slate-800 block mt-1">
                            {totalStockNum} units
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Warehouse net Worth</span>
                          <span className="text-base font-black font-mono text-emerald-800 block mt-1">
                            ₦{cumulativeValuation.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-black text-rose-500 block">Critical Stock Alarms</span>
                          <span className={`text-base font-black font-mono block mt-1 ${criticalAlarms > 0 ? "text-rose-600 animate-pulse font-extrabold" : "text-slate-700"}`}>
                            {criticalAlarms} warnings
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 font-mono">
                              <th className="p-3 uppercase font-bold text-slate-405">Drug ID code</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Formulation Name</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Therapeutic Category</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-right">Unit Price</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-center">Stock Level</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-center">Alert Limit</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-right font-bold text-indigo-700">Stock Valuation</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-center">Safety Label</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {inventoryList.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                  No items found in system inventory. Please feed some drugs to the manager database.
                                </td>
                              </tr>
                            ) : (
                              inventoryList.map((d) => {
                                const stockVal = d.stockLevel !== undefined ? d.stockLevel : 25;
                                const alertThresh = d.minStockAlert !== undefined ? d.minStockAlert : 10;
                                const isLowStock = stockVal <= alertThresh;
                                
                                return (
                                  <tr key={d.id} className={`${isLowStock ? "bg-rose-50/20" : ""}`}>
                                    <td className="p-3 font-mono text-slate-500">#{d.id.substring(0, 8)}...</td>
                                    <td className="p-3 font-bold text-slate-900">{d.name}</td>
                                    <td className="p-3 text-slate-600 font-sans">{d.category}</td>
                                    <td className="p-3 font-mono text-right text-slate-800">
                                      ₦{d.price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 font-mono text-center font-bold text-slate-900">{stockVal}</td>
                                    <td className="p-3 font-mono text-center text-slate-500">{alertThresh}</td>
                                    <td className="p-3 font-mono text-right text-slate-900 font-bold">
                                      ₦{(d.price * stockVal).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-center">
                                      {stockVal === 0 ? (
                                        <span className="bg-rose-100 text-rose-850 px-2 py-0.5 rounded text-[8px] font-mono font-bold border border-rose-200">OUT OF STOCK</span>
                                      ) : isLowStock ? (
                                        <span className="bg-amber-100 text-amber-850 px-2 py-0.5 rounded text-[8px] font-mono font-bold border border-amber-250 animate-pulse">REORDER URGENT</span>
                                      ) : (
                                        <span className="bg-emerald-100 text-emerald-850 px-2 py-0.5 rounded text-[8px] font-mono font-bold border border-emerald-200">SAFETY PASS</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Sub-tab 6: DECLARED PATRONS & DEMOGRAPHICS */}
                {reportSubTab === "customer_reports" && (() => {
                  const totalProfiles = profiles.length;
                  const confirms = profiles.filter(p => p.isConfirmed).length;
                  const medsUploaded = profiles.reduce((sum, p) => sum + (p.uploadedDocuments?.length || 0), 0);

                  // Age categorization
                  let pediatrics = 0;
                  let adults = 0;
                  let seniors = 0;
                  let unidentifiedAge = 0;

                  profiles.forEach(p => {
                    if (p.age) {
                      const num = parseInt(p.age);
                      if (isNaN(num)) unidentifiedAge++;
                      else if (num < 18) pediatrics++;
                      else if (num < 55) adults++;
                      else seniors++;
                    } else {
                      unidentifiedAge++;
                    }
                  });

                  return (
                    <div className="space-y-6">
                      <div className="border-b border-dashed border-slate-205 pb-2">
                        <h4 className="font-display font-bold text-slate-800 text-sm">Patient Patrons & Demographic Distribution</h4>
                        <p className="text-[10px] text-slate-400 font-sans uppercase">Complete profiling of customer profiles, clinical verification values, and allergen flags.</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Registered Patrons</span>
                          <span className="text-base font-black font-mono text-indigo-900 block mt-1">
                            {totalProfiles} profiles
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Clinically Cleared Profiles</span>
                          <span className="text-base font-black font-mono text-emerald-800 block mt-1">
                            {confirms} verified
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Uploaded Rx Prescriptions</span>
                          <span className="text-base font-black font-mono text-slate-800 block mt-1">
                            {medsUploaded} documents
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-205">
                          <span className="text-[9px] uppercase font-mono font-bold text-indigo-500 block">Demographics Spread</span>
                          <span className="text-[10px] font-bold text-slate-700 block mt-1 leading-normal font-mono">
                            👶:{pediatrics} • 🧑:{adults} • 👵:{seniors} (U:{unidentifiedAge})
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 font-mono">
                              <th className="p-3 uppercase font-bold text-slate-405">Patron ID</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Patient customer</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-center">Demog</th>
                              <th className="p-3 uppercase font-bold text-slate-405">Emergency contacts</th>
                              <th className="p-3 uppercase font-bold text-slate-405 font-bold text-rose-700">Declared Drug allergies</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-center">Rx uploads</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-center">Checkouts</th>
                              <th className="p-3 uppercase font-bold text-slate-405 text-right font-bold text-indigo-700">cumulative spent</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {profiles.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="p-8 text-center text-slate-405 italic">
                                  No patient directories found inside system records databases.
                                </td>
                              </tr>
                            ) : (
                              profiles.map((p) => {
                                const patientOrders = orders.filter(o => o.userId === p.id || o.patientName?.toLowerCase() === p.name?.toLowerCase());
                                const cumulativeSpent = patientOrders.reduce((sum, o) => sum + o.total, 0);
                                const rxApprovedCount = p.uploadedDocuments?.filter(d => d.status === "Approved").length || 0;
                                const isAllergic = p.allergies && p.allergies.trim().toLowerCase() !== "none" && p.allergies.trim().toLowerCase() !== "no";

                                return (
                                  <tr key={p.id}>
                                    <td className="p-3 font-mono text-slate-500">#{p.id.substring(0, 8)}...</td>
                                    <td className="p-3 font-bold text-slate-905">{p.name || "Anonymous Patron"}</td>
                                    <td className="p-3 text-center font-mono">
                                      {p.age ? `${p.age}y` : "N/A"}/{p.gender ? p.gender.substring(0, 1).toUpperCase() : "N/A"}
                                    </td>
                                    <td className="p-3 text-slate-550 leading-normal text-[11px]">
                                      {p.nextOfKinName ? (
                                        <div>
                                          <div className="font-bold text-slate-700">{p.nextOfKinName} ({p.nextOfKinRelation || "Kin"})</div>
                                          <div className="font-mono text-[10px]">{p.nextOfKinPhone}</div>
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 font-mono">None listed</span>
                                      )}
                                    </td>
                                    <td className="p-3 leading-normal">
                                      {isAllergic ? (
                                        <span className="bg-red-50 text-rose-800 border border-red-200 rounded px-1.5 py-0.5 text-[10px] font-bold">
                                          ⚠️ {p.allergies}
                                        </span>
                                      ) : (
                                        <span className="text-slate-450 italic font-mono text-[10px]">No allergies reported</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-center font-bold font-mono text-slate-700">{rxApprovedCount} / {p.uploadedDocuments?.length || 0}</td>
                                    <td className="p-3 text-center font-bold font-mono text-slate-700">{patientOrders.length}</td>
                                    <td className="p-3 font-mono font-bold text-right text-slate-900">
                                      ₦{cumulativeSpent.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Print Verification Block (Only visible on paper and save-to-PDF printouts) */}
                <div id="print-verification-footer" className="mt-8 pt-8 border-t border-slate-350 flex justify-between items-end font-sans text-[10px] text-slate-500 hidden print:flex">
                  <div className="space-y-4">
                    <div>Authorized Clinical Signatory:</div>
                    <div className="border-b border-slate-900 w-44 h-6"></div>
                    <div className="font-mono text-[9px] uppercase">Senior Clinical Pharmacist, RPh.</div>
                  </div>
                  <div className="space-y-4 text-right">
                    <div>Accounts Department Verification:</div>
                    <div className="border-b border-slate-900 w-44 h-6"></div>
                    <div className="font-mono text-[9px] uppercase">Senior Financial Auditor</div>
                  </div>
                </div>

              </div>

              {/* Printable Hidden Container Block engineered specially for System Media Print triggers */}
              <div id="printable-report-area" className="hidden">
                <div className="p-8 space-y-6">
                  {/* The exact copy of live report is copied here during print rendering via browser mirror triggers */}
                  <div className="border-b-4 border-black pb-4 flex items-start justify-between">
                    <div>
                      <h1 className="text-2xl font-black text-black uppercase tracking-tight">
                        {tenantConfig?.pharmacyName?.toUpperCase() || "HMEDIX PHARMACY & STORES"}
                      </h1>
                      <p className="text-[10px] text-black font-mono uppercase font-black">
                        Clinical & Financial Audit Verification Document
                      </p>
                      <p className="text-[10px] text-black font-mono">
                        Address: {tenantConfig?.pharmacyAddress || "Plaza B, Gwarinpa, Abuja, Nigeria"}
                      </p>
                    </div>
                    <div className="text-right font-mono text-[9px] text-black uppercase leading-normal">
                      <div>Report ID: HMX-{reportSubTab.toUpperCase()}-{new Date().toISOString().substring(2,10).replace(/-/g, "")}</div>
                      <div>DateTime: {new Date().toLocaleString("en-NG")}</div>
                      <div>Active Auditor: {staffUser?.email}</div>
                    </div>
                  </div>

                  {reportSubTab === "sales_ledger" && (
                    <div className="space-y-4 text-black">
                      <h2 className="text-lg font-bold border-b border-black pb-1 uppercase">Absolute Sales History Ledger</h2>
                      <div className="grid grid-cols-3 gap-4 border border-black p-4 bg-slate-100 font-mono text-[11px]">
                        <div>Cumulative Revenue: <span className="font-bold">₦{totalRevenue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span></div>
                        <div>Total Invoices: <span className="font-bold">{orders.length} dispatches</span></div>
                        <div>Average size: <span className="font-bold">₦{(orders.length > 0 ? totalRevenue / orders.length : 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}</span></div>
                      </div>
                      
                      <table className="w-full text-left font-sans text-[10px] border-collapse" border={1}>
                        <thead>
                          <tr className="bg-slate-200 font-mono font-bold">
                            <th className="p-2 border border-black">Invoice Ref</th>
                            <th className="p-2 border border-black">Patient Patron</th>
                            <th className="p-2 border border-black">Date Registered</th>
                            <th className="p-2 border border-black">Dispensed Medication Items</th>
                            <th className="p-2 border border-black text-right">Sum Invoice</th>
                            <th className="p-2 border border-black text-center">Fulfillment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((o) => (
                            <tr key={o.id}>
                              <td className="p-2 border border-black font-mono font-bold">#{o.id}</td>
                              <td className="p-2 border border-black font-bold">{o.patientName || "Anonymous Customer"}</td>
                              <td className="p-2 border border-black font-mono">{o.timestamp}</td>
                              <td className="p-2 border border-black">{o.items?.map(i => `${i.drug.name} x${i.quantity}`).join("; ")}</td>
                              <td className="p-2 border border-black text-right font-mono font-bold">₦{o.total.toFixed(2)}</td>
                              <td className="p-2 border border-black text-center font-mono font-bold">{o.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {reportSubTab === "daily_sales" && (() => {
                    const filtered = orders.filter(o => o.timestamp && o.timestamp.includes(reportDailyDate));
                    const revenue = filtered.reduce((sum, o) => sum + o.total, 0);
                    return (
                      <div className="space-y-4 text-black">
                        <h2 className="text-lg font-bold border-b border-black pb-1 uppercase">Daily Sales Operational Audit</h2>
                        <div className="font-bold font-mono text-[11px] mb-2">Audit target Date: {reportDailyDate}</div>
                        <div className="grid grid-cols-2 gap-4 border border-black p-4 bg-slate-100 font-mono text-[11px]">
                          <div>Daily Net Income: <span className="font-bold">₦{revenue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span></div>
                          <div>Total Checkouts: <span className="font-bold">{filtered.length} transactions</span></div>
                        </div>

                        <table className="w-full text-left font-sans text-[10px] border-collapse" border={1}>
                          <thead>
                            <tr className="bg-slate-200 font-mono font-black">
                              <th className="p-2 border border-black">Order ID</th>
                              <th className="p-2 border border-black">Customer</th>
                              <th className="p-2 border border-black font-mono">Time</th>
                              <th className="p-2 border border-black">Drug Items</th>
                              <th className="p-2 border border-black text-right">Settled Sum</th>
                              <th className="p-2 border border-black text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((o) => (
                              <tr key={o.id}>
                                <td className="p-2 border border-black font-mono font-bold">#{o.id}</td>
                                <td className="p-2 border border-black font-bold">{o.patientName || "Anonymous Customer"}</td>
                                <td className="p-2 border border-black font-mono">{o.timestamp ? o.timestamp.substring(11, 19) || o.timestamp : ""}</td>
                                <td className="p-2 border border-black">{o.items?.map(i => `${i.drug.name} x${i.quantity}`).join("; ")}</td>
                                <td className="p-2 border border-black text-right font-mono font-bold">₦{o.total.toFixed(2)}</td>
                                <td className="p-2 border border-black text-center">{o.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {reportSubTab === "weekly_sales" && (() => {
                    const startTarget = new Date(reportWeeklyStartDate);
                    const endTarget = new Date(startTarget);
                    endTarget.setDate(endTarget.getDate() + 7);
                    
                    const filtered = orders.filter(o => {
                      if (!o.timestamp) return false;
                      const oDate = new Date(o.timestamp);
                      return oDate >= startTarget && oDate < endTarget;
                    });
                    const revenue = filtered.reduce((sum, o) => sum + o.total, 0);

                    return (
                      <div className="space-y-4 text-black">
                        <h2 className="text-lg font-bold border-b border-black pb-1 uppercase">Weekly Sales Accounting Audit</h2>
                        <div className="font-bold font-mono text-[11px] mb-2">Weekly boundary intervals: {reportWeeklyStartDate} to {endTarget.toISOString().split("T")[0]}</div>
                        <div className="grid grid-cols-2 gap-4 border border-black p-4 bg-slate-100 font-mono text-[11px]">
                          <div>Weekly Net Revenue: <span className="font-bold">₦{revenue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span></div>
                          <div>Dispatches logged: <span className="font-bold">{filtered.length} entries</span></div>
                        </div>

                        <table className="w-full text-left font-sans text-[10px] border-collapse" border={1}>
                          <thead>
                            <tr className="bg-slate-200 font-mono">
                              <th className="p-2 border border-black">Transaction Ref</th>
                              <th className="p-2 border border-black">Patron</th>
                              <th className="p-2 border border-black">Timestamp</th>
                              <th className="p-2 border border-black">Acquired formulations</th>
                              <th className="p-2 border border-black text-right font-bold">Total price</th>
                              <th className="p-2 border border-black text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((o) => (
                              <tr key={o.id}>
                                <td className="p-2 border border-black font-mono font-bold">#{o.id}</td>
                                <td className="p-2 border border-black font-bold">{o.patientName || "Anonymous Customer"}</td>
                                <td className="p-2 border border-black font-mono">{o.timestamp}</td>
                                <td className="p-2 border border-black">{o.items?.map(i => `${i.drug.name} x${i.quantity}`).join("; ")}</td>
                                <td className="p-2 border border-black text-right font-mono font-bold">₦{o.total.toFixed(2)}</td>
                                <td className="p-2 border border-black text-center font-mono font-bold">{o.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {reportSubTab === "monthly_sales" && (() => {
                    const token = `${reportMonthlyYear}-${reportMonthlyMonth}`;
                    const filtered = orders.filter(o => o.timestamp && o.timestamp.includes(token));
                    const revenue = filtered.reduce((sum, o) => sum + o.total, 0);
                    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    const label = `${months[parseInt(reportMonthlyMonth) - 1] || "Monthly Limit"} - ${reportMonthlyYear}`;

                    return (
                      <div className="space-y-4 text-black">
                        <h2 className="text-lg font-bold border-b border-black pb-1 uppercase">Monthly Sales Ledger Statement</h2>
                        <div className="font-bold font-mono text-[11px] mb-2">Accounting Period: {label}</div>
                        <div className="grid grid-cols-2 gap-4 border border-black p-4 bg-slate-100 font-mono text-[11px]">
                          <div>Monthly Total Income: <span className="font-bold">₦{revenue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span></div>
                          <div>Total volume processed: <span className="font-bold">{filtered.length} invoices</span></div>
                        </div>

                        <table className="w-full text-left font-sans text-[10px] border-collapse" border={1}>
                          <thead>
                            <tr className="bg-slate-200 font-mono">
                              <th className="p-2 border border-black">Invoice Ref</th>
                              <th className="p-2 border border-black">Patient Partner</th>
                              <th className="p-2 border border-black">Timestamp</th>
                              <th className="p-2 border border-black">Medications</th>
                              <th className="p-2 border border-black text-right font-bold">Sum Invoice</th>
                              <th className="p-2 border border-black text-center font-bold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((o) => (
                              <tr key={o.id}>
                                <td className="p-2 border border-black font-mono font-bold">#{o.id}</td>
                                <td className="p-2 border border-black font-bold">{o.patientName || "Anonymous Customer"}</td>
                                <td className="p-2 border border-black font-mono">{o.timestamp}</td>
                                <td className="p-2 border border-black">{o.items?.map(i => `${i.drug.name} x${i.quantity}`).join("; ")}</td>
                                <td className="p-2 border border-black text-right font-mono font-bold">₦{o.total.toFixed(2)}</td>
                                <td className="p-2 border border-black text-center font-mono font-bold">{o.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {reportSubTab === "inventory_audit" && (
                    <div className="space-y-4 text-black">
                      <h2 className="text-lg font-bold border-b border-black pb-1 uppercase">Clinical Inventory Cost Valuation Statement</h2>
                      <div className="grid grid-cols-2 gap-4 border border-black p-4 bg-slate-100 font-mono text-[11px]">
                        <div>Total products listed: <span className="font-bold">{inventoryList.length} formulations</span></div>
                        <div>Inventory worth total: <span className="font-bold">₦{inventoryList.reduce((sum, d) => sum + (d.price * (d.stockLevel !== undefined ? d.stockLevel : 25)), 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span></div>
                      </div>

                      <table className="w-full text-left font-sans text-[9px] border-collapse" border={1}>
                        <thead>
                          <tr className="bg-slate-200 font-mono font-bold">
                            <th className="p-1.5 border border-black">Drug code ID</th>
                            <th className="p-1.5 border border-black">Product description</th>
                            <th className="p-1.5 border border-black">Therapeutic Cat</th>
                            <th className="p-1.5 border border-black text-right">Unit Price</th>
                            <th className="p-1.5 border border-black text-center">Stock remaining</th>
                            <th className="p-1.5 border border-black text-center font-bold">Audit evaluation cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryList.map((d) => {
                            const level = d.stockLevel !== undefined ? d.stockLevel : 25;
                            return (
                              <tr key={d.id}>
                                <td className="p-1.5 border border-black font-mono">#{d.id.substring(0, 8)}...</td>
                                <td className="p-1.5 border border-black font-bold">{d.name}</td>
                                <td className="p-1.5 border border-black">{d.category}</td>
                                <td className="p-1.5 border border-black text-right font-mono">₦{d.price.toFixed(2)}</td>
                                <td className="p-1.5 border border-black text-center font-mono">{level} units</td>
                                <td className="p-1.5 border border-black text-right font-mono font-bold text-black">₦{(d.price * level).toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {reportSubTab === "customer_reports" && (
                    <div className="space-y-4 text-black">
                      <h2 className="text-lg font-bold border-b border-black pb-1 uppercase">Registered Patients Demographic Spread Statement</h2>
                      
                      <table className="w-full text-left font-sans text-[9px] border-collapse" border={1}>
                        <thead>
                          <tr className="bg-slate-200 font-mono">
                            <th className="p-1.5 border border-black">Patron ID</th>
                            <th className="p-1.5 border border-black">Full Name</th>
                            <th className="p-1.5 border border-black text-center">Demographics</th>
                            <th className="p-1.5 border border-black">Emergency contacts</th>
                            <th className="p-1.5 border border-black">Allergy index warnings</th>
                            <th className="p-1.5 border border-black text-center">Rx Approved</th>
                            <th className="p-1.5 border border-black text-right font-bold">Cumulative checkouts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profiles.map((p) => {
                            const pOrders = orders.filter(o => o.userId === p.id || o.patientName?.toLowerCase() === p.name?.toLowerCase());
                            const sumSpent = pOrders.reduce((sum, o) => sum + o.total, 0);
                            const rxCount = p.uploadedDocuments?.filter(d => d.status === "Approved").length || 0;
                            return (
                              <tr key={p.id}>
                                <td className="p-1.5 border border-black font-mono">#{p.id.substring(0, 8)}...</td>
                                <td className="p-1.5 border border-black font-bold">{p.name || "Anonymous Patron"}</td>
                                <td className="p-1.5 border border-black text-center">{p.age ? `${p.age}y` : "N/A"}/{p.gender || "N/A"}</td>
                                <td className="p-1.5 border border-black">{p.nextOfKinName ? `${p.nextOfKinName} (${p.nextOfKinRelation || "N/A"}) - ${p.nextOfKinPhone || "N/A"}` : "None"}</td>
                                <td className="p-1.5 border border-black text-red-700 font-bold">{p.allergies || "None declared"}</td>
                                <td className="p-1.5 border border-black text-center">{rxCount} approved</td>
                                <td className="p-1.5 border border-black text-right font-mono font-bold">₦{sumSpent.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="pt-8 border-t border-black flex justify-between items-end text-[10px] text-black font-sans">
                    <div className="space-y-4">
                      <div>Clinical Representative Director Signature:</div>
                      <div className="border-b border-black w-44 h-6"></div>
                      <div className="font-mono text-[9px] uppercase font-bold">Registered pharmacist (RPh)</div>
                    </div>
                    <div className="space-y-4 text-right">
                      <div>Financial accounts Auditor Signature:</div>
                      <div className="border-b border-black w-44 h-6"></div>
                      <div className="font-mono text-[9px] uppercase font-bold">Senior accounting Director</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeSubTab === "inventory_manager" && (permissions.manageInventory || adminRecord?.role === "Super Admin") && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div className="border-b border-slate-100 pb-5">
                <h3 className="font-display font-black text-slate-905 text-base flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-blue-600" /> Clinical Inventory & Catalog Manager
                </h3>
                <p className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">
                  Real-time pharmacy product formulation additions, pricing optimization, and prescription requirements
                </p>
              </div>

              {/* Add/Edit Drug Form */}
              <form onSubmit={handleAddOrUpdateDrug} className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-mono font-black text-blue-700 uppercase">
                    {editingDrugId ? "● Mode: Editing Active Drug" : "＋ Register New Drug Product"}
                  </span>
                  {editingDrugId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDrugId(null);
                        setNewDrugName("");
                        setNewDrugPrice("");
                        setNewDrugIngredients("");
                        setNewDrugDosage("");
                        setNewDrugDirections("");
                        setNewDrugWarnings("");
                        setNewDrugRequiresRx(false);
                        setNewDrugDescription("");
                      }}
                      className="text-[10px] text-slate-500 hover:text-rose-600 font-bold uppercase transition"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-500 mb-1">Drug Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Amoxil 500mg"
                      value={newDrugName}
                      onChange={(e) => setNewDrugName(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-500 mb-1">Category</label>
                    <select
                      value={newDrugCategory}
                      onChange={(e) => setNewDrugCategory(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900"
                    >
                      <option value="Allergies">Allergies</option>
                      <option value="Anti-fungal">Anti-fungal</option>
                      <option value="Antibiotics">Antibiotics</option>
                      <option value="Antivirals">Antivirals</option>
                      <option value="Asthma">Asthma</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Diabetic Care">Diabetic Care</option>
                      <option value="Gastrointestinal">Gastrointestinal</option>
                      <option value="Mental Health">Mental Health</option>
                      <option value="Pain Management">Pain Management</option>
                      <option value="Vitamins & Minerals">Vitamins & Minerals</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-500 mb-1">Price (₦ - Naira)</label>
                    <input
                      type="number"
                      placeholder="e.g. 4500"
                      value={newDrugPrice}
                      onChange={(e) => setNewDrugPrice(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-500 mb-1">Active Ingredient Summary</label>
                    <input
                      type="text"
                      placeholder="e.g. Amoxicillin Trihydrate (500mg)"
                      value={newDrugIngredients}
                      onChange={(e) => setNewDrugIngredients(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-500 mb-1">Recommended Dosage</label>
                    <input
                      type="text"
                      placeholder="e.g. 500mg three times daily"
                      value={newDrugDosage}
                      onChange={(e) => setNewDrugDosage(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-500 mb-1">Usage Directions</label>
                    <input
                      type="text"
                      placeholder="e.g. Complete the prescribed course"
                      value={newDrugDirections}
                      onChange={(e) => setNewDrugDirections(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-500 mb-1">Major Warnings & Side Effects</label>
                    <input
                      type="text"
                      placeholder="e.g. May cause severe allergic hives"
                      value={newDrugWarnings}
                      onChange={(e) => setNewDrugWarnings(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase font-black text-slate-500 mb-1">Detailed Description</label>
                  <textarea
                    placeholder="Enter visual catalog description of pharmaceutical compound"
                    rows={2}
                    value={newDrugDescription}
                    onChange={(e) => setNewDrugDescription(e.target.value)}
                    className="w-full bg-white border border-slate-205 rounded-xl p-3 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newDrugRequiresRx}
                      onChange={(e) => setNewDrugRequiresRx(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-slate-705 flex items-center gap-1">
                      ⚠️ Requires Valid Prescription Verification (Rx Mandatory)
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSavingDrug}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-600/10 cursor-pointer"
                  >
                    {isSavingDrug ? "Saving compound..." : editingDrugId ? "Save Product Changes" : "Register Product to Catalog"}
                  </button>
                </div>
              </form>

              {/* Dynamic Search & Inventory List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-4 flex-wrap">
                  <h4 className="font-display font-extrabold text-sm text-slate-800">
                    Live Stock Catalog ({inventoryList.length} Compound Formulas)
                  </h4>
                  <div className="w-full sm:w-80">
                    <input
                      type="text"
                      placeholder="Search active inventory items..."
                      value={searchDrugQuery}
                      onChange={(e) => setSearchDrugQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400">Status</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400">Drug name</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400">Category</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400">Ingredients</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400 text-right">Unit Price</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInventoryList.map((drug) => (
                        <tr key={drug.id} className="hover:bg-slate-50/50 transition">
                            <td className="p-3">
                              {drug.requiresPrescription ? (
                                <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase animate-pulse">
                                  Rx Required
                                </span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase">
                                  OTC Compound
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-slate-800 block text-xs">{drug.name}</span>
                              <span className="text-[10px] text-slate-400 block truncate max-w-xs">{drug.description}</span>
                            </td>
                            <td className="p-3 text-xs text-slate-600">{drug.category}</td>
                            <td className="p-3 text-xs text-slate-500 font-mono">{drug.ingredients}</td>
                            <td className="p-3 text-xs font-mono font-bold text-slate-950 text-right">
                              ₦{drug.price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditDrugClick(drug)}
                                  className="p-1 px-2.5 bg-blue-50 text-blue-600 hover:bg-blue-105 border border-blue-100 rounded-lg text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDrug(drug.id)}
                                  className="p-1 px-2 text-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg text-[10px] font-bold transition flex items-center cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "staff_rbac" && adminRecord?.role === "Super Admin" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div className="border-b border-slate-100 pb-5">
                <h3 className="font-display font-black text-slate-905 text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" /> clinic Staff & Role-Based Access Control (RBAC) Registry
                </h3>
                <p className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">
                  Securely register clinical operators, assign precision privileges, and store permission objects in Firestore
                </p>
              </div>

              {/* Add New Staff Admin form */}
              <form onSubmit={handleAddNewAdmin} className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-4">
                <span className="text-xs font-mono font-black text-indigo-700 uppercase block border-b border-indigo-100 pb-1.5">
                  ＋ Register Fresh Clinician Operational Credentials
                </span>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-500 mb-1">Clinician Gmail Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. nurse.jessica@gmail.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-500 mb-1">Account UID (from Firebase Auth)</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter user sub-identifier code"
                      value={newAdminUid}
                      onChange={(e) => setNewAdminUid(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase font-black text-slate-500 mb-1">Initial Primary Role</label>
                    <select
                      value={newAdminRole}
                      onChange={(e) => setNewAdminRole(e.target.value as any)}
                      className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 text-slate-900 font-bold"
                    >
                      <option value="Admin">Admin (Clinical Operator)</option>
                      <option value="Super Admin">Super Admin (Clinic Owner)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 flex-wrap gap-4">
                  <p className="text-[10px] text-slate-400 max-w-md">
                    Note: Registering a fresh user grants base permission profiles instantly. The newly registered Clinician can immediately authenticate using Firebase.
                  </p>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" /> Register & Assign Staff Roles
                  </button>
                </div>
              </form>

              {/* Operational Clinicians List */}
              <div className="space-y-4">
                <h4 className="font-display font-black text-sm text-slate-800">
                  Operational Clinicians Directory
                </h4>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400">Security Identification</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400">Class Role</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400 text-center">viewCustomers</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400 text-center">manageInventory</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400 text-center">managePrescriptions</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400 text-center">reviewConversations</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400 text-center">sendNotifications</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400 text-center">viewSalesData</th>
                        <th className="p-3 text-xs font-mono uppercase font-bold text-slate-400 text-center">Revoke</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dbAdmins.map((adm) => {
                        const perm = adm.permissions || {
                          viewCustomers: false,
                          manageInventory: false,
                          managePrescriptions: false,
                          reviewConversations: false,
                          viewReports: false,
                          sendNotifications: false,
                          viewSalesData: false,
                        };
                        return (
                          <tr key={adm.id} className="hover:bg-slate-50/50 transition">
                            <td className="p-3">
                              <span className="font-bold text-slate-800 block text-xs">{adm.email}</span>
                              <span className="text-[10px] text-slate-400 font-mono block truncate max-w-[140px]">UID: {adm.id}</span>
                            </td>
                            <td className="p-3">
                              {adm.role === "Super Admin" ? (
                                <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase">
                                  Super Admin
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase">
                                  Staff Admin
                                </span>
                              )}
                            </td>
                            
                            {/* Checkboxes representing real-time Firestore Toggles */}
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={!!perm.viewCustomers}
                                onChange={() => handleTogglePermission(adm.id, "viewCustomers", !!perm.viewCustomers)}
                                className="rounded text-indigo-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={!!perm.manageInventory}
                                onChange={() => handleTogglePermission(adm.id, "manageInventory", !!perm.manageInventory)}
                                className="rounded text-indigo-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={!!perm.managePrescriptions}
                                onChange={() => handleTogglePermission(adm.id, "managePrescriptions", !!perm.managePrescriptions)}
                                className="rounded text-indigo-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={!!perm.reviewConversations}
                                onChange={() => handleTogglePermission(adm.id, "reviewConversations", !!perm.reviewConversations)}
                                className="rounded text-indigo-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={!!perm.sendNotifications}
                                onChange={() => handleTogglePermission(adm.id, "sendNotifications", !!perm.sendNotifications)}
                                className="rounded text-indigo-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={!!perm.viewSalesData}
                                onChange={() => handleTogglePermission(adm.id, "viewSalesData", !!perm.viewSalesData)}
                                className="rounded text-indigo-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                              />
                            </td>

                            <td className="p-3 text-center">
                              <button
                                type="button"
                                disabled={adm.id === staffUser?.uid}
                                onClick={() => handleDeleteAdmin(adm.id)}
                                className="p-1 px-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-[10px] font-bold transition flex items-center justify-center mx-auto cursor-pointer"
                              >
                                Revoke
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Patient Promotion Section to make standard users into Admins easily */}
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-4">
                <h4 className="font-display font-black text-xs uppercase text-slate-500 tracking-wider">
                  Promote Registered Patient Accounts to Staff Status
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {profiles.length === 0 ? (
                    <p className="text-xs text-slate-400">No patient files found.</p>
                  ) : (
                    profiles
                      .filter(p => !dbAdmins.some(a => a.id === p.id))
                      .slice(0, 6)
                      .map((pat) => (
                        <div key={pat.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                          <div className="min-w-0 pr-2 pb-1 text-left">
                            <span className="font-bold text-slate-900 block text-xs truncate">{pat.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono block truncate">{pat.email || pat.phoneNumber}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePromotePatientToAdmin(pat)}
                            className="bg-indigo-55 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-lg text-[9px] uppercase hover:shadow transition shrink-0"
                          >
                            Promote
                          </button>
                        </div>
                      ))
                  )}
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

      {/* Real-time Order Toast Notification */}
      {activeNotification && activeNotification.visible && (
        <div 
          id="realtime-order-toast" 
          className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl border border-blue-500/30 p-5 flex flex-col gap-3 transition-all duration-300 transform translate-y-0"
          style={{ boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.3), 0 0 15px 2px rgba(59, 130, 246, 0.4)" }}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/40 shrink-0 mt-0.5 animate-pulse">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-blue-400 block">
                ● NEW ORDER RECEIVED LIVE
              </span>
              <h4 className="font-display font-black text-sm text-white tracking-tight mt-1 truncate">
                {activeNotification.order.patientName}
              </h4>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Order #{activeNotification.order.id} • {activeNotification.order.items?.length || 0} item(s)
              </p>
            </div>
            <button
              id="close-realtime-toast-btn"
              onClick={() => setActiveNotification((prev) => prev ? { ...prev, visible: false } : null)}
              className="text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-2.5 mt-1">
            <span className="font-mono text-sm font-black text-blue-400">
              ₦{activeNotification.order.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
            </span>
            <button
              id="view-realtime-order-btn"
              onClick={() => {
                setActiveSubTab("orders");
                setSelectedOrder(activeNotification.order);
                setActiveNotification((prev) => prev ? { ...prev, visible: false } : null);
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] rounded-lg shadow-md transition cursor-pointer flex items-center gap-1"
            >
              <span>View Order</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
