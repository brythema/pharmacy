import { useState } from "react";
import { CartItem, PatientProfile, Drug } from "../types";
import { Trash2, HeartPulse, RefreshCw, AlertTriangle, CheckSquare, Sparkles, ShoppingBag, ShieldAlert, X } from "lucide-react";

interface CartProps {
  cartItems: CartItem[];
  onRemoveFromCart: (drugId: string) => void;
  onUpdateQty: (drugId: string, qty: number) => void;
  profile: PatientProfile | null;
  onCheckout: (auditReportText?: string | null) => void;
  onOpenProfile: () => void;
  tenantConfig?: {
    pharmacyName: string;
    nurseName: string;
    logoUrl: string;
    themeColor: string;
    pharmacyAddress: string;
    whatsappNumber: string;
  };
  isCheckingOut?: boolean;
  pendingConfirmOrderId?: string | null;
}

export default function Cart({
  cartItems,
  onRemoveFromCart,
  onUpdateQty,
  profile,
  onCheckout,
  onOpenProfile,
  tenantConfig,
  isCheckingOut = false,
  pendingConfirmOrderId = null,
}: CartProps) {
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditReport, setAuditReport] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const subtotal = cartItems.reduce((acc, item) => acc + item.drug.price * item.quantity, 0);
  const containsPrescription = cartItems.some((item) => item.drug.requiresPrescription);

  const handleRunAudit = async () => {
    if (cartItems.length === 0 || auditLoading) return;
    setAuditLoading(true);
    setAuditReport(null);
    setErrorMsg(null);

    try {
      const response = await fetch("/api/nurse/cart-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartItems: cartItems.map((c) => c.drug),
          profile: profile || {},
          tenantConfig: tenantConfig,
        }),
      });

      const data = await response.json();
      if (response.ok && data.text) {
        setAuditReport(data.text);
        setShowReportModal(true);
      } else {
        setErrorMsg("Clinical safety screening encountered an issue: " + (data.error || "Could not complete safety audit. Please verify standard internet protocols."));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Network security path blocked. Let's make sure our environment keys are loaded.");
    } finally {
      setAuditLoading(false);
    }
  };

  const handlePlaceOrder = () => {
    onCheckout(auditReport);
  };

  // Helper inside report modal to structure bullets/headers elegantly
  const renderAuditReportText = (text: string) => {
    const lines = text.split("\n");
    return (
      <div className="space-y-2 text-sm leading-relaxed text-slate-800">
        {lines.map((line, i) => {
          let trimmed = line.trim();

          // Standard bullet line
          if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
            const content = trimmed.substring(2);
            return (
              <li key={i} className="list-disc list-inside ml-2 text-slate-655 font-semibold">
                {renderBoldPhrases(content)}
              </li>
            );
          }

          // Numbered bullet line
          if (/^\d+\.\s/.test(trimmed)) {
            const content = trimmed.replace(/^\d+\.\s/, "");
            const num = trimmed.match(/^\d+/)?.toString() || "1";
            return (
              <div key={i} className="flex gap-2 ml-1 text-slate-655 font-semibold">
                <span className="font-mono text-blue-605 font-bold">{num}.</span>
                <span>{renderBoldPhrases(content)}</span>
              </div>
            );
          }

          // Headers
          if (trimmed.startsWith("###")) {
            return (
              <h5 key={i} className="font-sans font-bold text-slate-900 text-sm mt-3 border-l-2 border-red-500 pl-2">
                {trimmed.replace(/^###\s*/, "")}
              </h5>
            );
          }
          if (trimmed.startsWith("##")) {
            return (
              <h4 key={i} className="font-sans font-bold text-red-600 text-base mt-4 mb-1">
                {trimmed.replace(/^##\s*/, "")}
              </h4>
            );
          }
          if (trimmed.startsWith("#")) {
            return (
              <h3 key={i} className="font-sans font-black text-slate-900 text-lg mt-5 mb-2">
                {trimmed.replace(/^#\s*/, "")}
              </h3>
            );
          }

          if (trimmed === "---") {
            return <hr key={i} className="border-slate-100 my-4" />;
          }

          return <p key={i} className="paragraph min-h-[1px]">{renderBoldPhrases(line)}</p>;
        })}
      </div>
    );
  };

  const renderBoldPhrases = (str: string) => {
    const regex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      parts.push(
        <strong key={match.index} className="font-bold text-red-700 bg-red-50 px-1 py-0.5 rounded border border-red-100 text-xs">
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
    <div id="shopping-cart-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-slate-50 text-slate-800 min-h-[calc(100vh-4rem)]">
      
      <div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight-extrabold">
          Pharmacy Cart & Safety Audit
        </h1>
        <p className="text-sm text-slate-500 mt-1 font-mono font-bold uppercase tracking-wider text-[10px]">
          Live AI Interaction screening against your personal clinical profile
        </p>
      </div>

      {pendingConfirmOrderId && (
        <div id="checkout-approval-banner" className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-sm animate-pulse">
          <div className="space-y-1.5 text-left">
            <div className="flex items-center gap-2 text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
              <span className="font-mono font-extrabold text-xs uppercase tracking-wider">AWAITING MANUALLY CONFIRMED STATUS</span>
            </div>
            <h4 className="text-sm font-black text-slate-900">
              Checkout Transmitted & Pending Admin Approval
            </h4>
            <p className="text-xs text-slate-650 leading-relaxed font-semibold">
              Your medication request has been successfully queued as ID <span className="font-mono text-amber-800 font-bold">#{pendingConfirmOrderId}</span>. It has been routed to the pharmacy admin dashboard and WhatsApp. Under localized safety policy, the cart is locked and remains active until a registered Bmedix pharmacist verifies and approves the order.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2 bg-amber-100/60 font-mono text-[10px] font-bold text-amber-900 border border-amber-200/50 px-3.5 py-2 rounded-2xl">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
            <span>POLLING VERIFICATION</span>
          </div>
        </div>
      )}

      {cartItems.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Cart items list - Col span 2 */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <div
                key={item.drug.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition duration-150"
              >
                {/* Information */}
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-2xl font-bold font-mono shadow-sm">
                    {item.drug.image}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-sans font-bold text-slate-900 text-base">
                        {item.drug.name}
                      </h3>
                      {item.drug.requiresPrescription && (
                        <span className="px-1.5 py-0.5 bg-red-50 border border-red-100 text-red-600 rounded text-[9px] font-bold font-mono tracking-wider uppercase">
                          Rx Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1 font-mono">
                      Active: {item.drug.ingredients}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {item.drug.dosage}
                    </p>
                  </div>
                </div>

                {/* Operations: quantities / delete */}
                <div className="flex items-center gap-6 self-end sm:self-center">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onUpdateQty(item.drug.id, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-mono text-sm pl-1 font-bold text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQty(item.drug.id, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {/* Price */}
                  <div className="text-right min-w-[70px]">
                    <span className="block text-[10px] text-slate-400 font-mono uppercase font-semibold">Subtotal</span>
                    <span className="font-mono text-sm tracking-tight font-black text-blue-650">
                      ₦{(item.drug.price * item.quantity).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Trash */}
                  <button
                    onClick={() => onRemoveFromCart(item.drug.id)}
                    className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-650 transition cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Checkout & Safety panel - Col span 1 */}
          <div className="space-y-6">
            
            <div className="p-6 rounded-2xl bg-white border border-slate-205 shadow-sm space-y-6">
              <h3 className="font-sans font-black text-slate-900 text-base">
                Order Billing
              </h3>

              {containsPrescription && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs leading-relaxed space-y-1 font-medium">
                  <span className="font-bold uppercase font-mono block text-red-800">Prescription required</span>
                  <p className="text-red-655 text-xs">Your cart contains at least one prescription-only medication. Under localized pharmacy acts, you must supply doctor info at lookup.</p>
                </div>
              )}

              {/* Subtotal blocks */}
              <div className="space-y-2 border-b border-slate-100 pb-4 text-sm text-slate-550">
                <div className="flex justify-between">
                  <span>Dispensing Subtotal</span>
                  <span className="font-mono text-slate-805 font-bold">₦{subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>AI Clinic Safety Audit</span>
                  <span className="font-mono text-blue-600 font-bold uppercase text-xs">FREE</span>
                </div>
                <div className="flex justify-between">
                  <span>Bmedix Localized Courier</span>
                  <span className="font-mono text-slate-805 font-bold">₦2,000.00</span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-800 uppercase">Grand Total</span>
                <span className="font-mono text-2xl font-black text-blue-650">
                  ₦{(subtotal + 2000).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Safety Pre-requisite trigger */}
              <div className="pt-2">
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-slate-700 mb-4 space-y-3 font-medium">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
                    <span className="font-extrabold uppercase font-mono text-blue-650">AI Medical Clearing active</span>
                  </div>
                  <p className="text-slate-600 text-xs font-medium leading-relaxed">
                    Always execute the clinical safety check before checking out! Doublecheck your list for allergy conflicts or drug-drug clashes instantly. This protects your health 24/7.
                  </p>
                  
                  {profile ? (
                    <div className="text-[11px] font-mono text-blue-650 border-t border-blue-100 pt-2 flex items-center justify-between">
                      <span>✓ Profile linked to {profile.name}</span>
                      <button onClick={onOpenProfile} type="button" className="underline text-[10px] text-slate-550 hover:text-slate-800 cursor-pointer hover:no-underline font-bold">Edit Profile</button>
                    </div>
                  ) : (
                    <div className="text-[11px] font-mono text-red-600 border-t border-red-100 pt-2 flex flex-col gap-2">
                      <span>⚠️ Guest Session: Running generic evaluation</span>
                      <button
                        type="button"
                        onClick={onOpenProfile}
                        className="w-full text-center py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md font-sans text-xs text-red-600 transition font-bold"
                      >
                        Set Medical Profile First
                      </button>
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex gap-2 font-semibold relative leading-relaxed mb-4">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                    <div className="pr-6">
                      <p className="font-bold">Safety Screening Interrupted</p>
                      <p className="text-[11px] text-red-600 mt-0.5">{errorMsg}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setErrorMsg(null)}
                      className="absolute top-2 right-2 p-1 rounded-lg text-red-400 hover:text-red-700 hover:bg-red-100 transition cursor-pointer"
                      title="Dismiss alert"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Audit trigger buttons */}
                <button
                  type="button"
                  disabled={auditLoading}
                  onClick={handleRunAudit}
                  className="w-full py-3 rounded-xl bg-white border border-blue-200 text-blue-600 font-extrabold hover:bg-slate-50 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 shadow-sm hover:shadow"
                >
                  {auditLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Screening Contraindications...</span>
                    </>
                  ) : (
                    <>
                      <HeartPulse className="w-4 h-4 text-blue-600" />
                      <span>AI Nurse Safety Audit</span>
                    </>
                  )}
                </button>

                {auditLoading && (
                  <div className="mt-3 p-3.5 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-3 animate-pulse">
                    <RefreshCw className="w-4 h-4 text-rose-600 animate-spin shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-black text-rose-950">Active Clinical Examination</p>
                      <p className="text-[11px] text-rose-700 leading-relaxed font-semibold">
                        Please wait, your health is our priority. Checking allergy records, drug overlaps, and medical status.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Checkout / Invoice */}
              <button
                type="button"
                disabled={isCheckingOut}
                onClick={handlePlaceOrder}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black tracking-tight text-sm shadow-sm transition duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCheckingOut ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
                    <span>Place Order & Arrange Delivery</span>
                  </>
                )}
              </button>

            </div>
          </div>

        </div>
      ) : (
        <div className="mx-auto max-w-md py-20 text-center bg-white border border-slate-200 rounded-3xl p-8 space-y-4 shadow-sm">
          <p className="text-lg text-slate-800 font-bold">Your Cart is Empty</p>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            Browse through our over-the-counter and clinical prescription medication catalog to add drugs. Reach out to the AI Nurse for help selecting medication based on your symptoms.
          </p>
        </div>
      )}

      {/* Clinical Report Modal */}
      {showReportModal && auditReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl bg-white border border-slate-205 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-800">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-red-50 border border-red-150 text-red-650 rounded-lg">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-sans font-black text-slate-900 text-base leading-none">Clinical Safety Audit Report</h4>
                  <span className="text-[9px] uppercase font-mono tracking-wider text-slate-450 mt-1 block font-bold leading-none">Nurse Sarah, Bmedix Pharmacy</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-xs text-red-750 flex gap-2 font-semibold leading-relaxed">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                <p>
                  This safety report is generated using our advanced electronic clinical AI. This assists in looking up sensitivities, duplicate therapies, or dangerous overlapping doses, but does not substitute standard in-person physician checks.
                </p>
              </div>

              {/* Report Contents */}
              <div id="ai-clinical-audit-report" className="p-6 rounded-2xl bg-white border border-slate-200 shadow-inner">
                {renderAuditReportText(auditReport)}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-655 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close Safety Review
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReportModal(false);
                  handlePlaceOrder();
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition"
              >
                Approve & Complete Checkout
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
