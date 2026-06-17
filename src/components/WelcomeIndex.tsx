import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { 
  HeartPulse, 
  ShieldCheck, 
  Sparkles, 
  User, 
  Lock, 
  ArrowRight, 
  ShieldAlert, 
  Mail, 
  Phone, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  LockKeyhole,
  FileCheck2,
  LockKeyholeOpen
} from "lucide-react";

interface WelcomeIndexProps {
  onSignInWithGoogle: () => void;
  onSignInWithCredentials: (
    emailOrUsername: string,
    password: string,
    isRegistering: boolean,
    fullName?: string,
    phoneNumber?: string
  ) => Promise<void>;
  tenantConfig?: {
    pharmacyName: string;
    nurseName: string;
    logoUrl?: string;
  };
}

export default function WelcomeIndex({ onSignInWithGoogle, onSignInWithCredentials, tenantConfig }: WelcomeIndexProps) {
  const pharmacyName = tenantConfig?.pharmacyName || "Bmedix";
  const nurseName = tenantConfig?.nurseName || "Nurse Sarah";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [showResetFlow, setShowResetFlow] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [agreeTerms, setAgreeTerms] = useState<boolean>(true);

  // Brute-force Login Mitigation Lockout states
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutSecs, setLockoutSecs] = useState<number>(0);

  // Lockout decrementation effect
  React.useEffect(() => {
    if (lockoutSecs <= 0) return;
    const interval = setInterval(() => {
      setLockoutSecs((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSecs]);

  // Informative/Validation state
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [appleInfoOpen, setAppleInfoOpen] = useState<boolean>(false);

  // Client-side validations
  const validateForm = (): boolean => {
    setValidationError(null);
    setSuccessMsg(null);

    // Common sanitization
    const trimmedEmail = email.trim();
    const trimmedPassword = password;

    if (!trimmedEmail) {
      setValidationError("Please enter your email address.");
      return false;
    }

    if (mode === "register") {
      if (!fullName.trim()) {
        setValidationError("Full Name is required to register an EHR record.");
        return false;
      }

      // Quick standard email check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setValidationError("Please provide a valid email address.");
        return false;
      }

      const strippedPhone = phoneNumber.replace(/\D/g, "");
      if (!phoneNumber.trim() || strippedPhone.length < 7) {
        setValidationError("Please provide a valid phone number (at least 7 numbers).");
        return false;
      }

      if (trimmedPassword.length < 6) {
        setValidationError("Weak password. Password must be at least 6 characters.");
        return false;
      }

      if (trimmedPassword !== confirmPassword) {
        setValidationError("Passwords do not match. Please verify both password fields.");
        return false;
      }

      if (!agreeTerms) {
        setValidationError("You must authorize the patient privacy & treatment terms.");
        return false;
      }
    } else {
      // Login validation
      if (!trimmedPassword) {
        setValidationError("Please type your secure password.");
        return false;
      }

      // If they input standard email, check format.
      // We allow simple string "admin" for easy testing without '@', but if they type anything with '@', check format.
      if (trimmedEmail.includes("@")) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          setValidationError("Please provide a valid email format.");
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;

    if (lockoutSecs > 0) {
      setValidationError(`⚠️ ACCESS PORTAL LOCKED: Too many failed attempts. Try again in ${lockoutSecs}s.`);
      return;
    }

    if (!validateForm()) return;

    setIsBusy(true);
    setValidationError(null);
    setSuccessMsg(null);

    try {
      await onSignInWithCredentials(
        email.trim(),
        password,
        mode === "register",
        mode === "register" ? fullName.trim() : undefined,
        mode === "register" ? phoneNumber.trim() : undefined
      );

      if (mode === "register") {
        setSuccessMsg("Account successfully registered and synchronized with the cloud db!");
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setFailedAttempts(0);
      } else {
        // Success login clears attempts
        setFailedAttempts(0);
      }
    } catch (err: any) {
      const msg = err.message || "An unexpected validation exception occurred. Please verify your connection.";
      setValidationError(msg);
      
      if (mode === "login") {
        setFailedAttempts((prev) => {
          const nextCount = prev + 1;
          if (nextCount >= 5) {
            setLockoutSecs(60);
          }
          return nextCount;
        });
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    if (isBusy) return;
    setValidationError(null);
    setSuccessMsg(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setValidationError("Please input your registered email address first to dispatch password reset.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setValidationError("Please enter a valid email address format (e.g. name@domain.com).");
      return;
    }

    setIsBusy(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setSuccessMsg(`🔐 Secure Key Reset dispatched! Check inbox: "${trimmedEmail}" for clinical recovery steps.`);
    } catch (err: any) {
      console.error(err);
      setValidationError(err.message || "Failed to trigger recovery dispatch. Verify matching email.");
    } finally {
      setIsBusy(false);
    }
  };

  const triggerGoogleSignIn = async () => {
    if (isBusy) return;
    setValidationError(null);
    setSuccessMsg(null);
    setIsBusy(true);
    try {
      await onSignInWithGoogle();
    } catch (err: any) {
      setValidationError("Failed to synchronize with Google Account. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleApplePlaceholderClick = () => {
    setAppleInfoOpen(true);
  };

  return (
    <div id="welcome-landing-surface" className="bg-slate-50 min-h-[calc(100vh-4rem)] text-slate-800 flex flex-col justify-between">
      
      {/* Absolute Professional Overlays */}
      <AnimatePresence>
        {appleInfoOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl relative text-slate-800"
            >
              <button 
                onClick={() => setAppleInfoOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 p-1 bg-slate-50 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
                title="Close Info"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex gap-3 mb-4 items-start">
                <div className="p-3 bg-slate-100 rounded-2xl text-slate-900 shrink-0">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M18.71,19.5 C17.88,20.74 17,21.95 15.66,21.97 C14.32,22 13.89,21.18 12.37,21.18 C10.84,21.18 10.37,21.95 9.1,22 C7.79,22.05 6.8,20.68 5.96,19.48 C4.25,17 2.94,12.45 4.7,9.39 C5.57,7.87 7.13,6.91 8.82,6.88 C10.1,6.86 11.32,7.75 12.11,7.75 C12.89,7.75 14.37,6.68 15.92,6.84 C16.57,6.87 18.39,7.1 19.56,8.82 C19.47,8.88 17.39,10.1 17.41,12.63 C17.44,15.65 20.06,16.66 20.1,16.67 C20.08,16.74 19.67,18.11 18.71,19.5 M15.97,4.17 C16.63,3.37 17.07,2.28 16.95,1 C16,1.04 14.9,1.6 14.24,2.38 C13.68,3.04 13.19,4.14 13.34,5.39 C14.39,5.47 15.4,4.88 15.97,4.17 Z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900 font-display">
                    Apple Health ID Connection
                  </h4>
                  <p className="text-[11px] text-slate-450 font-mono tracking-wider uppercase">
                    Security Guideline
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 leading-relaxed space-y-3">
                <p>
                  To link your personal Apple Health Records (EHR) and biometric authentication, your practitioner requires a certified Apple Developer ID Sandbox mapping.
                </p>
                <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-100 text-[11px] text-blue-800 leading-normal">
                  <span className="font-bold block mb-1">Testing Option:</span>
                  Please register using details matching your profile standard email, or click <strong>Express Sync with Google</strong> to check cloud services.
                </div>
              </div>

              <button 
                onClick={() => setAppleInfoOpen(false)}
                className="w-full mt-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all cursor-pointer shadow-md"
              >
                Understood, Proceed
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Side: Professional pitch about zero-trust safeguards */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[11px] font-bold text-blue-700 tracking-wide font-mono uppercase">
            <HeartPulse className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
            <span>FDA Level Smart Clinical Pharmacy</span>
          </div>

          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-slate-900 tracking-tight leading-none">
            Welcome to <span className="bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">{pharmacyName}</span>
          </h1>

          <p className="text-base text-slate-600 max-w-xl leading-relaxed">
            A secure digital medical catalog and clinical safety auditing platform. Log in to access your electronic record, analyze dangerous drug interactions, and review active safety queues under pharmacist supervision.
          </p>

          <div className="space-y-4 max-w-xl pt-2">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block">
              Core Patient Care Safeguards:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/70 shadow-sm flex gap-3 hover:border-blue-200/70 transition-all duration-300">
                <div className="p-2.5 bg-blue-50 rounded-xl h-fit text-blue-605 shrink-0">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 mb-0.5 leading-snug">
                    AI Clinical Nurse
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-normal font-medium mt-1">
                    Directly consult with {nurseName}, our safety auditor checking prescriptions against profile allergies and chronic states instantly.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/70 shadow-sm flex gap-3 hover:border-blue-200/70 transition-all duration-300">
                <div className="p-2.5 bg-blue-50 rounded-xl h-fit text-violet-600 shrink-0">
                  <ShieldCheck className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 mb-0.5 leading-snug">
                    EHR Contraindication Audit
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-normal font-medium mt-1">
                    Store structured demographics, medications, and contact records to prevent harmful interactions of complex formulations automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 rounded-2xl border border-amber-200 max-w-md text-[10.5px] text-amber-900 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>Note: Complete clinical files must carry active Next of Kin information and are audited securely via the Pharmacy Console dashboard.</span>
          </div>
        </div>

        {/* Right Side: Redesigned and Polished Authentication/Registration form container */}
        <div className="lg:col-span-12 xl:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl relative flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="space-y-5">
            <div className="text-center sm:text-left">
              <h3 className="font-display font-extrabold text-slate-900 text-xl tracking-tight">
                {showResetFlow ? "Access Key Recovery" : "Healthcare Security Login"}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mt-1">
                {showResetFlow ? "Credential Retrieval Protocol" : "EHR Cryptographic Access Portal"}
              </p>
            </div>

            {!showResetFlow ? (
              <>
                {/* Sliding Header Mode Selection Tabs */}
                <div className="relative grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-250">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setValidationError(null);
                      setSuccessMsg(null);
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                      mode === "login"
                        ? "bg-white text-slate-900 shadow-md font-extrabold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <LockKeyhole className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setValidationError(null);
                      setSuccessMsg(null);
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                      mode === "register"
                        ? "bg-white text-slate-900 shadow-md font-extrabold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>Register Care Account</span>
                  </button>
                </div>

                {/* Google & Apple Professional Options */}
                <div className="space-y-2 mt-2">
                  <div className="flex flex-col gap-2">
                    {/* Continue with Google */}
                    <button
                      type="button"
                      onClick={triggerGoogleSignIn}
                      disabled={isBusy}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all disabled:opacity-50"
                      title="Authenticate via Google SSO"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.37 0 3.383 2.55 1.258 6.355l4.008 3.41z"/>
                        <path fill="#4285F4" d="M23.04 12.261c0-.83-.075-1.62-.211-2.386H12v4.51h6.2a5.3 5.3 0 0 1-2.29 3.477l3.562 3.033c2.083-1.92 3.28-4.755 3.28-8.15c0-.16-.01-.322-.012-.484z"/>
                        <path fill="#FBBC05" d="M1.258 6.355A12.003 12.003 0 0 0 0 12c0 2.016.5 3.916 1.385 5.602l3.89-3.26a7.07 7.07 0 0 1-.03-2.342C5.232 11.168 5.232 10.455 5.266 9.765z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.955-1.075 7.94-2.914l-3.562-3.033A7.126 7.126 0 0 1 12 19.091a7.07 7.07 0 0 1-6.734-4.856L1.376 17.5A11.968 11.968 0 0 0 12 24z"/>
                      </svg>
                      <span>Continue with Google</span>
                    </button>

                    {/* Continue with Apple */}
                    <button
                      type="button"
                      onClick={handleApplePlaceholderClick}
                      disabled={isBusy}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-900 hover:bg-slate-850 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all disabled:opacity-50"
                      title="Authenticate via Apple ID"
                    >
                      <svg className="w-4 h-4 text-white fill-current shrink-0" viewBox="0 0 24 24">
                        <path d="M18.71,19.5 C17.88,20.74 17,21.95 15.66,21.97 C14.32,22 13.89,21.18 12.37,21.18 C10.84,21.18 10.37,21.95 9.1,22 C7.79,22.05 6.8,20.68 5.96,19.48 C4.25,17 2.94,12.45 4.7,9.39 C5.57,7.87 7.13,6.91 8.82,6.88 C10.1,6.86 11.32,7.75 12.11,7.75 C12.89,7.75 14.37,6.68 15.92,6.84 C16.57,6.87 18.39,7.1 19.56,8.82 C19.47,8.88 17.39,10.1 17.41,12.63 C17.44,15.65 20.06,16.66 20.1,16.67 C20.08,16.74 19.67,18.11 18.71,19.5 M15.97,4.17 C16.63,3.37 17.07,2.28 16.95,1 C16,1.04 14.9,1.6 14.24,2.38 C13.68,3.04 13.19,4.14 13.34,5.39 C14.39,5.47 15.4,4.88 15.97,4.17 Z" />
                      </svg>
                      <span>Continue with Apple</span>
                    </button>
                  </div>

                  <div className="relative my-4 flex items-center justify-center text-slate-350">
                    <div className="absolute inset-x-0 h-[1.5px] bg-slate-150" />
                    <span className="relative bg-white px-3 text-[9px] font-bold uppercase font-mono tracking-wider text-slate-400">
                      or sync with secure email credentials
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-2xl text-[11px] text-slate-650 leading-relaxed font-sans text-left my-2">
                🗝️ <strong>Secure Credential Reset:</strong> Enter your registered patient email address below. Our server will dispatch clinical password-update procedures straight to your inbox.
              </div>
            )}

            {/* Animated Feedback Messages */}
            <AnimatePresence mode="wait">
              {validationError && (
                <motion.div 
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-800 font-medium flex items-start gap-2 text-left"
                >
                  <AlertCircle className="w-4 h-4 text-red-650 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-red-900 block">Care Validation Alert</span>
                    <span>{validationError}</span>
                  </div>
                </motion.div>
              )}

              {successMsg && (
                <motion.div 
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 font-medium flex items-start gap-2 text-left"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-655 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-900 block">Success Verified</span>
                    <span>{successMsg}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={(e) => {
              if (showResetFlow) {
                e.preventDefault();
                handleForgotPassword();
              } else {
                handleSubmit(e);
              }
            }} className="space-y-4 text-left">
              
              {showResetFlow ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase text-slate-450 mb-1.5">
                      Your Registered Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. patient@caremed.org"
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:shadow-sm transition-all font-sans"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-55 mt-4"
                  >
                    <span>Dispatch Recovery Email</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowResetFlow(false);
                      setValidationError(null);
                      setSuccessMsg(null);
                    }}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono uppercase font-bold rounded-xl cursor-pointer transition-all border border-slate-200 text-center"
                  >
                    ← Return to Login Portal
                  </button>
                </div>
              ) : (
                <>
                  {/* Conditional Registration Fields */}
                  <AnimatePresence initial={false}>
                    {mode === "register" && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-4"
                      >
                        {/* Full Name field */}
                        <div>
                          <label className="block text-[10px] font-mono font-bold uppercase text-slate-450 mb-1.5">
                            Patient Full Name <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                              <User className="w-4 h-4" />
                            </span>
                            <input
                              type="text"
                              required
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder="e.g. Juliet Alagboda"
                              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:shadow-sm transition-all font-sans"
                            />
                          </div>
                        </div>

                        {/* Phone Number field */}
                        <div>
                          <label className="block text-[10px] font-mono font-bold uppercase text-slate-450 mb-1.5">
                            Mobile Phone Number <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                              <Phone className="w-4 h-4" />
                            </span>
                            <input
                              type="tel"
                              required
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              placeholder="e.g. +234 803 123 4567"
                              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:shadow-sm transition-all font-mono"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Shared Email Address field */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase text-slate-450 mb-1.5">
                      Email Address / Username <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. patient@caremed.org"
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:shadow-sm transition-all font-sans"
                      />
                    </div>
                  </div>

                  {/* Password field */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-mono font-bold uppercase text-slate-450">
                        Secure Password <span className="text-red-500">*</span>
                      </label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowResetFlow(true);
                            setValidationError(null);
                            setSuccessMsg(null);
                          }}
                          disabled={isBusy}
                          className="text-[10px] font-mono uppercase font-bold text-blue-600 hover:text-blue-800 focus:outline-none transition cursor-pointer"
                        >
                          Forgot Access Key?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:shadow-sm transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Password Confirm (Register only) */}
                  <AnimatePresence initial={false}>
                    {mode === "register" && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-2"
                      >
                        <div>
                          <label className="block text-[10px] font-mono font-bold uppercase text-slate-450 mb-1.5">
                            Confirm Secure Password <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                              <Lock className="w-4 h-4" />
                            </span>
                            <input
                              type="password"
                              required
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:shadow-sm transition-all font-mono"
                            />
                          </div>
                        </div>

                        {/* Terms Checkbox */}
                        <div className="flex items-start gap-2.5 pt-2">
                          <input 
                            type="checkbox"
                            id="agreeTerms"
                            checked={agreeTerms}
                            onChange={(e) => setAgreeTerms(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 focus:ring-blue-500 text-blue-600 h-3.5 w-3.5"
                          />
                          <label htmlFor="agreeTerms" className="text-[10px] text-slate-500 leading-snug cursor-pointer select-none">
                            I authorize CareMed platforms to synchronize my compliance record with local pharmacist review queues in accord with standard clinical privacy standards.
                          </label>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-55 mt-4"
                  >
                    <span>{mode === "login" ? "Access Medical Portal" : "Complete Safety Registration"}</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </button>
                </>
              )}
            </form>
          </div>
        </div>

      </div>

      {/* Trust banner */}
      <div className="bg-slate-900 text-slate-400 py-5 border-t border-slate-800 text-center text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono uppercase tracking-wider font-bold text-[9px]">
          <span>© 2026 {pharmacyName} Clinical Systems, Inc.</span>
          <span>Zero-Trust Patient Compliance Engine Activated • Up to 200 Active Patient Accounts Licensed</span>
        </div>
      </div>

    </div>
  );
}
