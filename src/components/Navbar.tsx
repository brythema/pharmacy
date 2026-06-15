import { useState, useEffect } from "react";
import { Plus, ShoppingCart, UserCheck, MessageSquare, BriefcaseMedical, Landmark, LogIn, LogOut, MessageCircle } from "lucide-react";
import { PatientProfile } from "../types";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  cartCount: number;
  profile: PatientProfile | null;
  onOpenProfile: () => void;
  user: any;
  isAdmin?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  tenantConfig?: {
    pharmacyName: string;
    nurseName: string;
    logoUrl: string;
    themeColor: string;
    pharmacyAddress: string;
    whatsappNumber: string;
  };
  showInstallButton?: boolean;
  onInstall?: () => void;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  cartCount,
  profile,
  onOpenProfile,
  user,
  isAdmin,
  onSignIn,
  onSignOut,
  tenantConfig,
  showInstallButton,
  onInstall,
}: NavbarProps) {
  const pharmacyName = tenantConfig?.pharmacyName || "H-Medix";
  const logoUrl = tenantConfig?.logoUrl || "";

  const [unreadSupportCount, setUnreadSupportCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadSupportCount(0);
      return;
    }
    try {
      const q = query(
        collection(db, "support_rooms"),
        where("userId", "==", user.uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let sum = 0;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          sum += (data.userUnreadCount || 0);
        });
        setUnreadSupportCount(sum);
      }, (err) => {
        console.warn("Blocked live support unread count: ", err);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  return (
    <header id="main-nav-bar" className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 text-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Slogan */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab("dashboard")}>
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={`${pharmacyName} Logo`}
                className="w-10 h-10 object-contain rounded-xl shadow-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-700 to-blue-500 rounded-xl flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-blue-500/15 group-hover:scale-105 transition-all duration-300">
                <Plus className="w-5 h-5 stroke-[3]" />
              </div>
            )}
            <div>
              <span className="font-display font-black text-xl tracking-tight text-slate-900 block leading-tight">
                {pharmacyName} <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">AI</span>
              </span>
              <span className="block text-[9px] text-slate-400 font-mono tracking-widest uppercase font-bold">
                Clinical Pharmacy
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex space-x-1.5">
            {user && (
              <>
                <button
                  id="nav-tab-dashboard"
                  onClick={() => setActiveTab("dashboard")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold tracking-tight transition-all cursor-pointer ${
                    activeTab === "dashboard"
                      ? "bg-blue-50 text-blue-650 border border-blue-100 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Dashboard
                </button>
                <button
                  id="nav-tab-catalog"
                  onClick={() => setActiveTab("catalog")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold tracking-tight transition-all cursor-pointer ${
                    activeTab === "catalog"
                      ? "bg-blue-50 text-blue-650 border border-blue-100 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Order Drugs
                </button>
                <button
                  id="nav-tab-chat"
                  onClick={() => setActiveTab("chat")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold tracking-tight transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === "chat"
                      ? "bg-blue-50 text-blue-655 border border-blue-100 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  Nurse Consult
                </button>
                <button
                  id="nav-tab-support"
                  onClick={() => setActiveTab("support")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold tracking-tight transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === "support"
                      ? "bg-blue-50 text-blue-655 border border-blue-100 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {unreadSupportCount > 0 ? (
                    <span className="relative flex h-2 w-2 animate-bounce">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-505 bg-red-500"></span>
                    </span>
                  ) : (
                    <MessageCircle className="w-4 h-4 text-indigo-505 text-indigo-500" />
                  )}
                  Support Helpdesk
                </button>

                {isAdmin && (
                  <button
                    id="nav-tab-pharmacy-console"
                    onClick={() => setActiveTab("pharmacy-console")}
                    className={`px-4 py-2 rounded-xl text-sm font-bold tracking-tight transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === "pharmacy-console"
                        ? "bg-violet-50 text-violet-750 border border-violet-100 shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <BriefcaseMedical className="w-4 h-4 text-violet-500" />
                    Clinic Console
                  </button>
                )}
              </>
            )}
          </nav>

          {/* Active Profile Status / Actions */}
          <div className="flex items-center gap-3">
            {/* PWA Install Button */}
            {showInstallButton && onInstall && (
              <button
                id="nav-btn-install"
                onClick={onInstall}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold cursor-pointer transition-all animate-bounce"
              >
                <Plus className="w-4 h-4 text-amber-600" />
                <span>Install App</span>
              </button>
            )}
            {/* Google Authentication Status */}
            {user ? (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-205">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full border border-blue-500/40"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                    {user.displayName?.charAt(0) || "U"}
                  </div>
                )}
                <span className="text-[10px] text-slate-600 font-mono hidden lg:inline max-w-[80px] truncate leading-tight font-semibold">
                  {user.displayName || "Cloud User"}
                </span>
                <button
                  id="nav-btn-signout"
                  onClick={onSignOut}
                  className="p-1 rounded hover:bg-red-50 text-slate-500 hover:text-red-650 transition cursor-pointer"
                  title="Sign Out of Cloud Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                id="nav-btn-signin"
                onClick={onSignIn}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-605 text-white hover:bg-blue-700 text-xs font-sans font-extrabold cursor-pointer transition-all shadow-md shadow-blue-500/10"
              >
                <LogIn className="w-4 h-4 text-white stroke-[2.5]" />
                <span>Express Login</span>
              </button>
            )}

            {/* Medical Profile Edit Button */}
            {user && (
              <button
                id="nav-btn-profile"
                onClick={onOpenProfile}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  profile
                    ? "bg-slate-55 border-slate-200 text-slate-700 hover:bg-slate-100"
                    : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100 animated pulse"
                }`}
              >
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">
                  {profile ? `${profile.name}` : "Create Medical Profile"}
                </span>
                <span className="sm:hidden">{profile ? "Profile" : "Set Profile"}</span>
              </button>
            )}

            {/* Cart Button */}
            {user && (
              <button
                id="nav-btn-cart"
                onClick={() => setActiveTab("cart")}
                className={`relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer ${
                  activeTab === "cart" ? "ring-2 ring-blue-500 text-blue-600 bg-blue-50/50" : ""
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-5 h-5 font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                    {cartCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav Rail */}
      {user && (
        <div className="md:hidden flex justify-around border-t border-slate-200 bg-white py-2.5 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`text-xs flex flex-col items-center gap-1 ${
              activeTab === "dashboard" ? "text-blue-600 font-bold" : "text-slate-500 font-medium"
            }`}
          >
            <span className="text-sm">📈</span>
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`text-xs flex flex-col items-center gap-1 ${
              activeTab === "catalog" ? "text-blue-600 font-bold" : "text-slate-500 font-medium"
            }`}
          >
            <span className="text-sm">🛒</span>
            <span>Order Drugs</span>
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`text-xs flex flex-col items-center gap-1 ${
              activeTab === "chat" ? "text-blue-600 font-bold" : "text-slate-500 font-medium"
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span>AI Nurse</span>
          </button>
          <button
            onClick={() => setActiveTab("support")}
            className={`text-xs flex flex-col items-center gap-1 relative ${
              activeTab === "support" ? "text-blue-600 font-bold" : "text-slate-500 font-medium"
            }`}
          >
            {unreadSupportCount > 0 ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            ) : (
              <span className="text-sm">📥</span>
            )}
            <span>Helpdesk</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab("pharmacy-console")}
              className={`text-xs flex flex-col items-center gap-1 ${
                activeTab === "pharmacy-console" ? "text-violet-605 font-bold animate-pulse" : "text-slate-505 font-medium"
              }`}
            >
              <span className="text-sm">🏥</span>
              <span>Console</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
}
