import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Catalog from "./components/Catalog";
import NurseChat from "./components/NurseChat";
import Cart from "./components/Cart";
import Orders from "./components/Orders";
import ProfilePanel from "./components/ProfilePanel";
import PharmacyConsole from "./components/PharmacyConsole";
import { Drug, PatientProfile, Message, CartItem, Order } from "./types";
import { Plus, X, HeartPulse, Sparkles, User, HelpCircle, ShieldAlert } from "lucide-react";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, setDoc, updateDoc, collection, query, where, orderBy, onSnapshot } from "firebase/firestore";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("catalog");
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [cartCount, setCartCount] = useState<number>(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [pendingDrugContext, setPendingDrugContext] = useState<Drug | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);

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

  // Firebase Auth and Firestore Cloud Sync Engine
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeOrders: (() => void) | null = null;
    let unsubscribeChat: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        console.log("Logged in in CareMed Platform: ", currentUser.uid);

        // 1. Sync Patient Profile
        const profileRef = doc(db, "profiles", currentUser.uid);
        unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const fbProfile = docSnap.data() as PatientProfile;
            setProfile(fbProfile);
            localStorage.setItem("caremed_patient_profile", JSON.stringify(fbProfile));
          } else {
            // Upscale local cache profile to the cloud
            const stored = localStorage.getItem("caremed_patient_profile");
            if (stored) {
              const parsed = JSON.parse(stored);
              setProfile(parsed);
              setDoc(profileRef, parsed).catch((err) =>
                handleFirestoreError(err, OperationType.WRITE, `profiles/${currentUser.uid}`)
              );
            }
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `profiles/${currentUser.uid}`);
        });

        // 2. Sync Patient Orders (filtered strictly by userId to satisfy rules and security)
        const ordersRef = collection(db, "orders");
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
          handleFirestoreError(err, OperationType.LIST, "orders");
        });

        // 3. Sync Patient Chat Messages (using strict subcollection path for security rules)
        const chatMessagesRef = collection(db, "chats", currentUser.uid, "messages");
        unsubscribeChat = onSnapshot(chatMessagesRef, (snapshot) => {
          const list: Message[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as Message);
          });
          list.sort((a, b) => a.id.localeCompare(b.id));

          if (list.length > 0) {
            setMessages(list);
            localStorage.setItem("caremed_chat_history", JSON.stringify(list));
          } else {
            // Auto seed welcome thread
            const welcomeText = `Hello! I am Nurse Sarah, your H-Medix AI Nurse tracker. I can help audit your care profile and check drug safety parameters immediately. Ask me any medical questions or sync your cloud account above!`;
            const seedId = "se-welcome";
            const seed: Message = {
              id: seedId,
              role: "assistant",
              content: welcomeText,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setDoc(doc(chatMessagesRef, seedId), seed).catch(console.error);
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, `chats/${currentUser.uid}/messages`);
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
    };
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Google Sign-In failed:", err);
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
        await setDoc(doc(db, "profiles", user.uid), newProfile);
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

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

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
    };

    if (user) {
      try {
        await setDoc(doc(db, "orders", transactionId), newOrder);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `orders/${transactionId}`);
      }
    } else {
      const updatedOrders = [newOrder, ...orders];
      setOrders(updatedOrders);
      localStorage.setItem("caremed_orders", JSON.stringify(updatedOrders));
    }

    // Reset shopping cart
    setCartItems([]);
    setCartCount(0);
    localStorage.removeItem("caremed_cart");

    // Transition to Orders tracking tab
    setActiveTab("orders");

    // Dynamic state simulation for user experience!
    // Transitions "Reviewing" -> "Dispensed" -> "Out for Delivery"
    setTimeout(async () => {
      if (user) {
        try {
          await updateDoc(doc(db, "orders", transactionId), { status: "Dispensed" });
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
          await updateDoc(doc(db, "orders", transactionId), { status: "Out for Delivery" });
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
  };

  // Safe Server-Side Chat flow
  const handleSendMessage = async (text: string) => {
    const userMsg: Message = {
      id: "usr-" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];

    if (user) {
      try {
        await setDoc(doc(db, "chats", user.uid, "messages", userMsg.id), userMsg);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `chats/${user.uid}/messages/${userMsg.id}`);
      }
    } else {
      setMessages(updatedMessages);
      localStorage.setItem("caremed_chat_history", JSON.stringify(updatedMessages));
    }

    setChatLoading(true);

    try {
      const response = await fetch("/api/nurse/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          profile: profile,
          pendingDrugContext: pendingDrugContext,
        }),
      });

      const data = await response.json();
      if (response.ok && data.text) {
        const nurseMsg: Message = {
          id: "sar-" + Date.now(),
          role: "assistant",
          content: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        if (user) {
          try {
            await setDoc(doc(db, "chats", user.uid, "messages", nurseMsg.id), nurseMsg);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `chats/${user.uid}/messages/${nurseMsg.id}`);
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
      };

      if (user) {
        try {
          await setDoc(doc(db, "chats", user.uid, "messages", fallbackMsg.id), fallbackMsg);
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
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      {/* Main viewport */}
      <main className="flex-1">
        {activeTab === "catalog" && (
          <Catalog
            onAddToCart={handleAddToCart}
            onInquireSafety={handleInquireSafety}
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
          />
        )}

        {activeTab === "orders" && (
          <Orders orders={orders} />
        )}

        {activeTab === "pharmacy-console" && (
          <PharmacyConsole
            onBackToApp={() => setActiveTab("catalog")}
            staffUser={user}
          />
        )}
      </main>

      {/* Personal Profile Overlay Dialog */}
      {isProfileOpen && (
        <ProfilePanel
          currentProfile={profile}
          onSave={saveProfile}
          onClose={() => setIsProfileOpen(false)}
        />
      )}

    </div>
  );
}
