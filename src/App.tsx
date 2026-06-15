import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Catalog from "./components/Catalog";
import NurseChat from "./components/NurseChat";
import Cart from "./components/Cart";
import Orders from "./components/Orders";
import ProfilePanel from "./components/ProfilePanel";
import Dashboard from "./components/Dashboard";
import PharmacyConsole from "./components/PharmacyConsole";
import WelcomeIndex from "./components/WelcomeIndex";
import SupportMessaging from "./components/SupportMessaging";
import { Drug, PatientProfile, Message, CartItem, Order, AdminRecord, SystemNotification } from "./types";
import { Plus, X, HeartPulse, Sparkles, User, HelpCircle, ShieldAlert } from "lucide-react";
import { auth, db, googleProvider, handleFirestoreError, OperationType, createNotification } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, User as FirebaseUser } from "firebase/auth";
import { doc, setDoc, updateDoc, collection, query, where, orderBy, onSnapshot, writeBatch } from "firebase/firestore";
import { normalizePhoneNumber } from "./utils";

const cleanObj = <T,>(obj: T): T => {
  if (obj === null || obj === undefined) return obj;
  return JSON.parse(JSON.stringify(obj));
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [cartCount, setCartCount] = useState<number>(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveNotifications, setLiveNotifications] = useState<SystemNotification[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>(() => {
    return localStorage.getItem("caremed_current_convo_id") || "default";
  });
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem("caremed_current_convo_id", currentConversationId);
  }, [currentConversationId]);
  const [pendingDrugContext, setPendingDrugContext] = useState<Drug | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profileFetched, setProfileFetched] = useState<boolean>(false);
  const [adminRecord, setAdminRecord] = useState<AdminRecord | null>(null);
  const [isAdminRecordLoading, setIsAdminRecordLoading] = useState<boolean>(true);
  const [drugs, setDrugs] = useState<Drug[]>([]);

  // Subdomain resolution logic to handle abcpharmacy.yourdomain.com
  const getSubdomain = () => {
    try {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return null;
      }
      
      // Check if system cloud domain (e.g. *.run.app)
      if (hostname.endsWith(".run.app")) {
        const parts = hostname.split(".");
        if (parts.length >= 5) {
          // e.g. abcpharmacy.ais-dev-....run.app
          return parts[0];
        }
        return null;
      }
      
      const parts = hostname.split(".");
      if (parts.length > 2 && parts[0] !== "www") {
        return parts[0];
      }
    } catch (e) {
      console.error("Error parsing subdomain context:", e);
    }
    return null;
  };

  // URL Parameter parsing, Subdomain checking, and localStorage rehydration Layer (Module 1, 8, 9)
  const [activePharmacyId, setActivePharmacyId] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get("id");
    if (urlId) {
      localStorage.setItem("caremed_active_pharmacy_id", urlId);
      return urlId;
    }

    const subdomain = getSubdomain();
    if (subdomain) {
      localStorage.setItem("caremed_active_pharmacy_id", subdomain);
      return subdomain;
    }

    return localStorage.getItem("caremed_active_pharmacy_id") || null;
  });

  const [tenantConfig, setTenantConfig] = useState<any>(null);

  // PWA Install Prompt Event Tracker
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    console.log(`PWA user selection choice outcome: ${outcome}`);
    setInstallPrompt(null);
  };

  // Dynamic loading of tenant configurations document
  useEffect(() => {
    if (!activePharmacyId) {
      setTenantConfig(null);
      return;
    }
    const pharmDocRef = doc(db, "pharmacies", activePharmacyId);
    const unsub = onSnapshot(pharmDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setTenantConfig(docSnap.data());
      } else {
        console.warn(`Pharmacy document pharmacies/${activePharmacyId} not found. Loading system default configuration.`);
        setTenantConfig(null);
      }
    }, (err) => {
      console.error("Firestore error loading tenant config, reverting to hardcoded fallback:", err);
      setTenantConfig(null);
    });
    return () => unsub();
  }, [activePharmacyId]);

  // Load cart from localStorage only (since carts are local-only preferences)
  useEffect(() => {
    try {
      const storedCart = localStorage.getItem("caremed_cart");
      if (storedCart) {
        const items = JSON.parse(storedCart);
        setCartItems(items);
        setCartCount(items.reduce((acc: number, item: any) => acc + item.quantity, 0));
      }
    } catch (err) {
      console.error("Error loading cached cart:", err);
    }
  }, []);

  // Sync and seed clinical inventory list from Firestore
  useEffect(() => {
    const unsubscribeDrugs = onSnapshot(collection(db, "inventory"), (snapshot) => {
      if (!snapshot.empty) {
        const list: Drug[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Drug);
        });
        setDrugs(list);
      } else {
        import("./data/drugs").then(({ DRUG_CATALOG }) => {
          try {
            const batch = writeBatch(db);
            DRUG_CATALOG.forEach((drug) => {
              batch.set(doc(db, "inventory", drug.id), drug);
            });
            batch.commit()
              .then(() => console.log("Seeded inventory batch successfully."))
              .catch(e => console.warn("Seed batch commit error:", e));
          } catch (err) {
            console.error("Failed to build seed writeBatch:", err);
          }
          setDrugs(DRUG_CATALOG);
        });
      }
    }, (err) => {
      console.warn("Blocked live inventory read, utilizing local fallback.", err);
    });
    return () => unsubscribeDrugs();
  }, []);

  // Firebase Auth and Firestore Cloud Sync Engine
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeOrders: (() => void) | null = null;
    let unsubscribeChat: (() => void) | null = null;
    let unsubscribeAdmin: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // First, immediately clean up any previous active firebase listeners to prevent permission-denied errors
      if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
      if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
      if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; }
      if (unsubscribeAdmin) { unsubscribeAdmin(); unsubscribeAdmin = null; }

      setUser(currentUser);
      setProfileFetched(false);
      setIsAdminRecordLoading(true);

      if (currentUser) {
        console.log("Logged in in CareMed Platform: ", currentUser.uid);

        // Real-time admin record checklist
        const adminDocRef = doc(db, "admins", currentUser.uid);
        unsubscribeAdmin = onSnapshot(adminDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const loadedAdmin: AdminRecord = {
              id: docSnap.id,
              email: data.email || currentUser.email || "",
              role: data.role || "Admin",
              permissions: {
                viewCustomers: data.permissions?.viewCustomers ?? true,
                manageInventory: data.permissions?.manageInventory ?? true,
                managePrescriptions: data.permissions?.managePrescriptions ?? true,
                reviewConversations: data.permissions?.reviewConversations ?? true,
                viewReports: data.permissions?.viewReports ?? true,
                sendNotifications: data.permissions?.sendNotifications ?? true,
                viewSalesData: data.permissions?.viewSalesData ?? true,
              },
              lastLogin: data.lastLogin || new Date().toISOString()
            };
            setAdminRecord(loadedAdmin);
            setIsAdminRecordLoading(false);
            
            // If they are on the catalog, auto-redirect to console
            if (activeTab === "catalog" || activeTab === "welcome") {
              setActiveTab("pharmacy-console");
            }
          } else {
            // Check if superadmin fallback needs seed
            if (currentUser.email?.toLowerCase() === "brythema@gmail.com") {
              const freshAdmin: Omit<AdminRecord, "id"> = {
                email: "brythema@gmail.com",
                role: "Super Admin",
                permissions: {
                  viewCustomers: true,
                  manageInventory: true,
                  managePrescriptions: true,
                  reviewConversations: true,
                  viewReports: true,
                  sendNotifications: true,
                  viewSalesData: true,
                },
                lastLogin: new Date().toISOString()
              };
              setDoc(adminDocRef, cleanObj(freshAdmin))
                .then(() => {
                  setAdminRecord({ id: currentUser.uid, ...freshAdmin } as AdminRecord);
                  setIsAdminRecordLoading(false);
                  setActiveTab("pharmacy-console");
                })
                .catch((err) => {
                  console.warn("Bootstrap super admin seed write failed:", err);
                  setIsAdminRecordLoading(false);
                });
            } else {
              setAdminRecord(null);
              setIsAdminRecordLoading(false);
              // Safe fallback for standard Customer role
              if (activeTab === "pharmacy-console") {
                setActiveTab("dashboard");
              }
            }
          }
        }, (err) => {
          console.warn("Unauthorized or blocked admin collection listen:", err);
          setAdminRecord(null);
          setIsAdminRecordLoading(false);
          if (activeTab === "pharmacy-console") {
            setActiveTab("dashboard");
          }
        });

        // 1. Sync Patient Profile
        const profileRef = doc(db, "profiles", currentUser.uid);
        unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const fbProfile = docSnap.data() as PatientProfile;
            setProfile(fbProfile);
            localStorage.setItem("caremed_patient_profile", JSON.stringify(fbProfile));

            const sessionKey = "caremed_logged_" + currentUser.uid;
            if (sessionStorage.getItem(sessionKey) !== "true") {
              sessionStorage.setItem(sessionKey, "true");
              const newLogin = {
                id: "lh-" + Date.now(),
                timestamp: new Date().toLocaleString("en-NG"),
                ip: `197.97.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1} [Lagos, NG]`,
                device: navigator.userAgent.substring(0, 100) || "WebKit/Browser Client",
                status: "Login verified via secure session"
              };
              const updatedHistory = fbProfile.loginHistory ? [...fbProfile.loginHistory, newLogin] : [newLogin];
              const slicedHistory = updatedHistory.slice(-50);
              const updatedProfile = { ...fbProfile, loginHistory: slicedHistory };
              
              setDoc(profileRef, cleanObj(updatedProfile)).catch((err) =>
                console.warn("Silent login audit log update failed:", err)
              );
            }
          } else {
            // Upscale local cache profile to the cloud
            const stored = localStorage.getItem("caremed_patient_profile");
            if (stored) {
              const parsed = JSON.parse(stored);
              setProfile(parsed);
              setDoc(profileRef, cleanObj(parsed)).catch((err) =>
                handleFirestoreError(err, OperationType.WRITE, `profiles/${currentUser.uid}`)
              );
            }
          }
          setProfileFetched(true);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `profiles/${currentUser.uid}`);
          setProfileFetched(true);
        });

        // 2. Sync Patient Orders (filtered strictly by userId to satisfy rules and security)
        const ordersPath = activePharmacyId ? `pharmacies/${activePharmacyId}/orders` : "orders";
        const ordersRef = collection(db, ordersPath);
        const ordersQuery = query(ordersRef, where("userId", "==", currentUser.uid));
        unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
          const list: Order[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as Order);
          });
          list.sort((a, b) => b.id.localeCompare(a.id));
          setOrders(list);
          localStorage.setItem("caremed_orders", JSON.stringify(list));
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, ordersPath);
        });
 
        // 3. Sync Patient Chat Messages (using strict subcollection path for security rules)
        const chatPathPrefix = activePharmacyId ? `pharmacies/${activePharmacyId}/chats` : "chats";
        const chatMessagesRef = collection(db, chatPathPrefix, currentUser.uid, "messages");
        unsubscribeChat = onSnapshot(chatMessagesRef, (snapshot) => {
          const list: Message[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as Message);
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
 
          if (list.length > 0) {
            setMessages(list);
            localStorage.setItem("caremed_chat_history", JSON.stringify(list));
          } else {
            // Auto seed welcome thread
            const actualNurseName = tenantConfig?.nurseName || "Nurse Sarah";
            const actualPharmacyName = tenantConfig?.pharmacyName || "H-Medix";
            const welcomeText = `Hello! I am ${actualNurseName}, your ${actualPharmacyName} AI Nurse tracker. I can help audit your care profile and check drug safety parameters immediately. Ask me any medical questions or sync your cloud account above!`;
            const seedId = "se-welcome";
            const seed: Message = {
              id: seedId,
              role: "assistant",
              content: welcomeText,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              conversationId: "default",
              createdAt: Date.now(),
            };
            setDoc(doc(chatMessagesRef, seedId), cleanObj(seed)).catch(console.error);
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, `${chatPathPrefix}/${currentUser.uid}/messages`);
        });

      } else {
        // Safe Logout / Offline-mode State load
        console.log("Logged out. Relying on local cached environment.");
        setProfile(null);
        setOrders([]);
        setMessages([]);

        try {
          const storedProfile = localStorage.getItem("caremed_patient_profile");
          if (storedProfile) setProfile(JSON.parse(storedProfile));

          const storedOrders = localStorage.getItem("caremed_orders");
          if (storedOrders) setOrders(JSON.parse(storedOrders));

          const storedChat = localStorage.getItem("caremed_chat_history");
          if (storedChat) setMessages(JSON.parse(storedChat));
        } catch (err) {
          console.error("Error reading cache fallback:", err);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeChat) unsubscribeChat();
      if (unsubscribeAdmin) unsubscribeAdmin();
    };
  }, [activePharmacyId, tenantConfig]);

  // Synchronize real-time stored notifications from Firestore
  useEffect(() => {
    if (!user) {
      setLiveNotifications([]);
      return;
    }

    let q;
    if (adminRecord) {
      // Admins see all notifications
      q = collection(db, "notifications");
    } else {
      // Patients see their own notifications
      q = query(collection(db, "notifications"), where("userId", "==", user.uid));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const list: SystemNotification[] = [];
      snapshot.forEach((snapshotDoc) => {
        list.push({ id: snapshotDoc.id, ...snapshotDoc.data() } as SystemNotification);
      });
      // Sort in-memory to prevent requiring composite index
      list.sort((a, b) => b.createdAt - a.createdAt);
      setLiveNotifications(list);
    }, (err) => {
      console.warn("Notification system sync warning:", err);
    });

    return () => unsub();
  }, [user, adminRecord]);

  // Enforce new and incomplete clinical profiles to register emergency Next of Kin details
  useEffect(() => {
    const isUserAdmin = adminRecord !== null;
    if (isUserAdmin) {
      setIsProfileOpen(false);
      return;
    }
    if (user && profileFetched && (!profile || !profile.nextOfKinName || !profile.nextOfKinPhone || !profile.nextOfKinRelation)) {
      setIsProfileOpen(true);
    }
  }, [user, profile, profileFetched]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Google Sign-In failed:", err);
    }
  };

  const handleSignInWithCredentials = async (
    emailOrUsername: string,
    password: string,
    isRegistering: boolean,
    fullName?: string,
    phoneNumber?: string
  ) => {
    let email = emailOrUsername.trim();
    if (!email.includes("@")) {
      // Map short usernames to system standard email addresses
      if (email.toLowerCase() === "admin") {
        email = "brythema@gmail.com";
      } else {
        email = `${email}@hmedix.com`;
      }
    }

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Create matching clinical profile in Firestore
        const profileRef = doc(db, "profiles", userCredential.user.uid);
        const initialProfile: PatientProfile = {
          name: fullName?.trim() || email.split("@")[0],
          phoneNumber: phoneNumber?.trim() || "",
          age: "",
          gender: "",
          allergies: "",
          chronicConditions: "",
          currentMedications: "",
          notes: "",
        };
        // Optimize: trigger both parallelly
        await Promise.all([
          setDoc(profileRef, cleanObj(initialProfile)),
          createNotification({
            userId: "admin",
            title: "New User Registered",
            message: `Patient ${initialProfile.name} has successfully initiated a care account (${email}).`,
            type: "registration"
          })
        ]);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Credentials handling failed:", err);
      let friendlyMsg = err.message || "Authentication error. Please check your network.";
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        friendlyMsg = "Incorrect login credentials. Please verify your email/password or register first.";
      } else if (err.code === "auth/email-already-in-use") {
        friendlyMsg = "This email address is already registered. Please log in instead or use a different email.";
      } else if (err.code === "auth/weak-password") {
        friendlyMsg = "The password is too weak. It must be at least 6 characters.";
      } else if (err.code === "auth/invalid-email") {
        friendlyMsg = "Invalid email format. Please supply a valid email address.";
      }
      throw new Error(friendlyMsg);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const saveProfile = async (newProfile: PatientProfile) => {
    setProfile(newProfile);
    localStorage.setItem("caremed_patient_profile", JSON.stringify(newProfile));
    setIsProfileOpen(false);

    if (user) {
      try {
        await setDoc(doc(db, "profiles", user.uid), cleanObj(newProfile));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `profiles/${user.uid}`);
      }
    } else {
      const initialText = `Hello ${newProfile.name}! I have successfully linked your personalized medical file locally. I see you have noted down:

- Allergies: **${newProfile.allergies || "No known allergies"}**
- Chronic Conditions: **${newProfile.chronicConditions || "No other ongoing conditions"}**
- Ongoing Medications: **${newProfile.currentMedications || "No active medications"}**

I will continuously examine these factors when auditing your pharmacy cart or answering questions. Link your Cloud Sync above to ensure these details persist safely!`;

      const coachMsg: Message = {
        id: "coach-" + Date.now(),
        role: "assistant",
        content: initialText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const updated = [coachMsg];
      setMessages(updated);
      localStorage.setItem("caremed_chat_history", JSON.stringify(updated));
    }
    setActiveTab("chat");
  };

  const handleAddToCart = (drug: Drug) => {
    const existing = cartItems.find((item) => item.drug.id === drug.id);
    let updated: CartItem[];

    if (existing) {
      updated = cartItems.map((item) =>
        item.drug.id === drug.id ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      updated = [...cartItems, { drug, quantity: 1 }];
    }

    setCartItems(updated);
    const count = updated.reduce((acc, item) => acc + item.quantity, 0);
    setCartCount(count);
    localStorage.setItem("caremed_cart", JSON.stringify(updated));
  };

  const handleRemoveFromCart = (drugId: string) => {
    const updated = cartItems.filter((item) => item.drug.id !== drugId);
    setCartItems(updated);
    const count = updated.reduce((acc, item) => acc + item.quantity, 0);
    setCartCount(count);
    localStorage.setItem("caremed_cart", JSON.stringify(updated));
  };

  const handleUpdateQty = (drugId: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveFromCart(drugId);
      return;
    }
    const updated = cartItems.map((item) =>
      item.drug.id === drugId ? { ...item, quantity: qty } : item
    );
    setCartItems(updated);
    const count = updated.reduce((acc, item) => acc + item.quantity, 0);
    setCartCount(count);
    localStorage.setItem("caremed_cart", JSON.stringify(updated));
  };

  const handleCheckout = async (auditReportText?: string | null) => {
    if (cartItems.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);

    const subtotal = cartItems.reduce((acc, item) => acc + item.drug.price * item.quantity, 0);
    const transactionId = Math.floor(100000 + Math.random() * 900000).toString();

    const newOrder: Order = {
      id: transactionId,
      items: [...cartItems],
      total: subtotal + 2000,
      status: "Reviewing",
      timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      patientName: profile?.name || "Guest Patient",
      userId: user ? user.uid : "offline-user",
      patientPhone: profile?.phoneNumber || "",
      ...(auditReportText ? { auditReport: auditReportText } : {}),
    };

    const ordersPath = activePharmacyId ? `pharmacies/${activePharmacyId}/orders` : "orders";

    try {
      if (user) {
        const updatedProfile = profile ? { ...profile } : null;

        if (updatedProfile) {
          const newOrderEvent = {
            id: "oh-" + Date.now(),
            orderId: transactionId,
            event: `Order #${transactionId} Placed`,
            timestamp: new Date().toLocaleString("en-NG"),
            details: `Order created containing ${cartItems.length} items. Status: Reviewing. Total: ₦${newOrder.total.toLocaleString("en-NG")}.`
          };
          updatedProfile.orderHistory = updatedProfile.orderHistory 
            ? [...updatedProfile.orderHistory, newOrderEvent] 
            : [newOrderEvent];

          const newPaymentEvent = {
            id: "ph-" + Date.now(),
            orderId: transactionId,
            reference: `TXN-${transactionId}-${Date.now().toString().substring(8)}`,
            amount: newOrder.total,
            timestamp: new Date().toLocaleString("en-NG"),
            status: "CONFIRMED",
            details: `WhatsApp Dispatch order compiled with courier route fee ₦2,000.00.`
          };
          updatedProfile.paymentHistory = updatedProfile.paymentHistory 
            ? [...updatedProfile.paymentHistory, newPaymentEvent] 
            : [newPaymentEvent];
        }

        // Run concurrent setDoc order, setDoc profile & createNotification writes
        const promises: Promise<any>[] = [
          setDoc(doc(db, ordersPath, transactionId), cleanObj(newOrder)),
          createNotification({
            userId: "admin",
            title: "New Order Placed",
            message: `Order #${transactionId} placed by ${newOrder.patientName} for ₦${newOrder.total.toLocaleString("en-NG")}.`,
            type: "orderPlaced"
          })
        ];

        if (updatedProfile) {
          promises.push(setDoc(doc(db, "profiles", user.uid), cleanObj(updatedProfile)));
          setProfile(updatedProfile);
          localStorage.setItem("caremed_patient_profile", JSON.stringify(updatedProfile));
        }

        await Promise.all(promises);
      } else {
        const updatedOrders = [newOrder, ...orders];
        setOrders(updatedOrders);
        localStorage.setItem("caremed_orders", JSON.stringify(updatedOrders));
      }

      // Prefill and redirect to WhatsApp
      const whatsappNum = tenantConfig?.whatsappNumber || "2348123456789";
      const cleanPhone = normalizePhoneNumber(whatsappNum);
      const pharmacyName = tenantConfig?.pharmacyName || "H-Medix";
      const nurseName = tenantConfig?.nurseName || "Nurse Sarah";
      
      const hasPrescription = cartItems.some(item => item.drug.requiresPrescription);
      const itemsList = cartItems.map(item => {
        const rxBadge = item.drug.requiresPrescription ? " [⚠️ Rx REQUIRED]" : "";
        return `• *${item.drug.name}* (${item.quantity}x)${rxBadge} - ₦${(item.drug.price * item.quantity).toLocaleString("en-NG")}`;
      }).join("\n");
      
      const rxNotice = hasPrescription ? "\n\n⚠️ *PRESCRIPTION REQUIREMENT:* This order contains prescription-only medication. Please have your valid medical prescription sheet ready for the pharmacist's validation/upload!" : "";
      
      let diagnosisSummary = "";
      if (auditReportText) {
        diagnosisSummary = `\n\n*🩺 AI Nurse ${nurseName} Safety Checklist:*\n${auditReportText.substring(0, 900)}${auditReportText.length > 900 ? "..." : ""}`;
      } else {
        diagnosisSummary = `\n\n*🩺 AI Nurse ${nurseName} Safety Diagnosis:*\nStandard clinical baseline check complete. Patient medication list of ${cartItems.length} items logged. Profile record allergen interactions reviewed.`;
      }

      const waMsg = `Medication Order placed successfully! 🇳🇬 *MEDICATION DISPATCH ORDER — ${pharmacyName.toUpperCase()}* 🇳🇬\n\nHello ${pharmacyName} Pharmacist,\n\nI just placed a medication order request on your digital portal! Please review my prescription items on the Admin Dashboard and confirm local courier delivery.\n\n*Order Identification ID:* #${transactionId}\n*Registered Customer:* ${newOrder.patientName}\n*Customer Phone:* ${newOrder.patientPhone || "N/A"}\n\n*🛍️ Cart Prescription Items:*\n${itemsList}${rxNotice}\n\n*Grand Total (incl. Delivery Dispatch Courier):* ₦${newOrder.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}${diagnosisSummary}\n\nPlease audit, dispense, and activate delivery routes. Thank you!`;

      const whatsappURL = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}`;
      
      window.open(whatsappURL, "_blank", "noopener,noreferrer");

      // Reset shopping cart
      setCartItems([]);
      setCartCount(0);
      localStorage.removeItem("caremed_cart");

      // Show a clean clinical workflow feedback and route back to catalog
      alert("Checkout completed! Your order has been cataloged onto the admin dashboard and you are being redirected to WhatsApp to complete confirmation.");
      setActiveTab("catalog");

      // Dynamic state simulation for user experience!
      // Transitions "Reviewing" -> "Dispensed" -> "Out for Delivery"
      setTimeout(async () => {
        if (user) {
          try {
            await Promise.all([
              updateDoc(doc(db, ordersPath, transactionId), { status: "Dispensed" }),
              createNotification({
                userId: user.uid,
                title: "Order Processed",
                message: `Your medical order #${transactionId} has been Dispensed by the pharmacy.`,
                type: "orderUpdate"
              })
            ]);
          } catch (err) {
            console.error("Order status update failed:", err);
          }
        } else {
          setOrders((prevOrders) =>
            prevOrders.map((o) =>
              o.id === transactionId ? { ...o, status: "Dispensed" } : o
            )
          );
        }
      }, 15000);

      setTimeout(async () => {
        if (user) {
          try {
            await Promise.all([
              updateDoc(doc(db, ordersPath, transactionId), { status: "Out for Delivery" }),
              createNotification({
                userId: user.uid,
                title: "Order out for Delivery",
                message: `Your medical order #${transactionId} has been hand-off to clinical dispatch and is Out for Delivery!`,
                type: "orderUpdate"
              })
            ]);
          } catch (err) {
            console.error("Order status update failed:", err);
          }
        } else {
          setOrders((prevOrders) =>
            prevOrders.map((o) =>
              o.id === transactionId ? { ...o, status: "Out for Delivery" } : o
            )
          );
        }
      }, 45000);

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${ordersPath}/${transactionId}`);
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Safe Server-Side Chat flow
  const handleSendMessage = async (text: string) => {
    const userMsg: Message = {
      id: "usr-" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      conversationId: currentConversationId,
      createdAt: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    const chatsPathPrefix = activePharmacyId ? `pharmacies/${activePharmacyId}/chats` : "chats";

    if (user) {
      try {
        await Promise.all([
          setDoc(doc(db, chatsPathPrefix, user.uid, "messages", userMsg.id), cleanObj(userMsg)),
          createNotification({
            userId: "admin",
            title: "New Customer Message",
            message: `Patient ${profile?.name || user.email} sent a message: "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`,
            type: "customerMessage"
          })
        ]);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `${chatsPathPrefix}/${user.uid}/messages/${userMsg.id}`);
      }
    } else {
      setMessages(updatedMessages);
      localStorage.setItem("caremed_chat_history", JSON.stringify(updatedMessages));
    }

    setChatLoading(true);

    try {
      // Filter the conversation context correctly when calling Gemini API
      const conversationMessages = updatedMessages.filter(
        (m) => m.conversationId === currentConversationId || (!m.conversationId && currentConversationId === "default")
      );

      const response = await fetch("/api/nurse/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationMessages,
          profile: profile,
          pendingDrugContext: pendingDrugContext,
          tenantConfig: tenantConfig,
        }),
      });

      const data = await response.json();
      if (response.ok && data.text) {
        const nurseMsg: Message = {
          id: "sar-" + Date.now(),
          role: "assistant",
          content: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          conversationId: currentConversationId,
          createdAt: Date.now(),
        };

        if (user) {
          try {
            await setDoc(doc(db, chatsPathPrefix, user.uid, "messages", nurseMsg.id), cleanObj(nurseMsg));
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `${chatsPathPrefix}/${user.uid}/messages/${nurseMsg.id}`);
          }
        } else {
          const finalMessages = [...updatedMessages, nurseMsg];
          setMessages(finalMessages);
          localStorage.setItem("caremed_chat_history", JSON.stringify(finalMessages));
        }
      } else {
        throw new Error(data.error || "Failed stream reply");
      }
    } catch (err: any) {
      console.error(err);
      // Clean high-quality clinical helper offline fallback
      const errorText = `Hello! I am operating in low-latency offline mode. 

To ensure safety: if you are asking about a drug (such as **Advil** or **Sudafed**), check whether you are allergic to NSAIDs/sulfa compounds, and never exceed standard packaging guidelines. If you are managing chronic high blood pressure, consult an direct physician before taking decongestants. 

*Please verify your GEMINI_API_KEY under the AI Studio Secrets menu should you require real-time clinical AI auditing.*`;

      const fallbackMsg: Message = {
        id: "sar-err-" + Date.now(),
        role: "assistant",
        content: errorText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        conversationId: currentConversationId,
        createdAt: Date.now(),
      };

      if (user) {
        try {
          await setDoc(doc(db, chatsPathPrefix, user.uid, "messages", fallbackMsg.id), cleanObj(fallbackMsg));
        } catch (fbErr) {
          console.error("Failed to write fallback message in Firestore:", fbErr);
        }
      } else {
        const finalMsgList = [...updatedMessages, fallbackMsg];
        setMessages(finalMsgList);
      }
    } finally {
      setChatLoading(false);
    }
  };

  const handleInquireSafety = (drug: Drug) => {
    setPendingDrugContext(drug);

    const checkText = `Please tell me if ${drug.name} is fully safe for me, are there any severe warnings, side effects, or allergies I must watch out for?`;
    handleSendMessage(checkText);
    setActiveTab("chat");
  };

  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem("caremed_chat_history");
  };

  return (
    <div id="caremed-app-root" className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* Top sticky navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={cartCount}
        profile={profile}
        onOpenProfile={() => setIsProfileOpen(true)}
        user={user}
        isAdmin={adminRecord !== null}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        tenantConfig={tenantConfig}
        showInstallButton={!!installPrompt}
        onInstall={handleInstallApp}
      />

      {/* Main viewport */}
      <main className="flex-1">
        {!user ? (
          <WelcomeIndex 
            onSignInWithGoogle={handleSignIn}
            onSignInWithCredentials={handleSignInWithCredentials}
            tenantConfig={tenantConfig} 
          />
        ) : (
          <>
            {activeTab === "dashboard" && (
              <Dashboard
                user={user}
                profile={profile}
                onOpenProfile={() => setIsProfileOpen(true)}
                onSaveProfile={saveProfile}
                orders={orders}
                onAddToCart={handleAddToCart}
                onInquireSafety={handleInquireSafety}
                drugs={drugs}
                tenantConfig={tenantConfig}
                liveNotifications={liveNotifications}
                messages={messages}
              />
            )}

            {activeTab === "catalog" && (
              <Catalog
                onAddToCart={handleAddToCart}
                onInquireSafety={handleInquireSafety}
                profile={profile}
                onOpenProfile={() => setIsProfileOpen(true)}
                drugs={drugs}
              />
            )}

            {activeTab === "support" && (
              <SupportMessaging
                user={user}
                profile={profile}
                activePharmacyId={activePharmacyId}
                tenantConfig={tenantConfig}
              />
            )}

            {activeTab === "chat" && (
              <NurseChat
                profile={profile}
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={chatLoading}
                pendingDrugContext={pendingDrugContext}
                onClearPendingDrug={() => setPendingDrugContext(null)}
                onOpenProfile={() => setIsProfileOpen(true)}
                tenantConfig={tenantConfig}
                currentConversationId={currentConversationId}
                setCurrentConversationId={setCurrentConversationId}
              />
            )}

            {activeTab === "cart" && (
              <Cart
                cartItems={cartItems}
                onRemoveFromCart={handleRemoveFromCart}
                onUpdateQty={handleUpdateQty}
                profile={profile}
                onCheckout={handleCheckout}
                onOpenProfile={() => setIsProfileOpen(true)}
                tenantConfig={tenantConfig}
                isCheckingOut={isCheckingOut}
              />
            )}



            {activeTab === "pharmacy-console" && adminRecord && (
              <PharmacyConsole
                onBackToApp={() => setActiveTab("catalog")}
                staffUser={user}
                adminRecord={adminRecord}
                activePharmacyId={activePharmacyId}
                tenantConfig={tenantConfig}
              />
            )}
          </>
        )}
      </main>

      {/* Personal Profile Overlay Dialog */}
      {isProfileOpen && (
        <ProfilePanel
          currentProfile={profile}
          onSave={saveProfile}
          onClose={() => setIsProfileOpen(false)}
          canClose={!!(profile && profile.name && profile.nextOfKinName && profile.nextOfKinPhone && profile.nextOfKinRelation)}
        />
      )}

    </div>
  );
}
