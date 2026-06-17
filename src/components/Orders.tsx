import { useState } from "react";
import { Order } from "../types";
import { CheckCircle2, Clock, Landmark, Truck, ShieldAlert, HeartPulse, Bell, BellRing } from "lucide-react";
import { normalizePhoneNumber } from "../utils";

interface OrdersProps {
  orders: Order[];
  tenantConfig?: {
    pharmacyName: string;
    nurseName: string;
    logoUrl: string;
    themeColor: string;
    pharmacyAddress: string;
    whatsappNumber: string;
  };
}

export default function Orders({ orders, tenantConfig }: OrdersProps) {
  const pharmacyName = tenantConfig?.pharmacyName || "Bmedix";
  const nurseName = tenantConfig?.nurseName || "Nurse Sarah";
  const pharmacyAddress = tenantConfig?.pharmacyAddress || "Abuja, Nigeria";
  const whatsappNumber = tenantConfig?.whatsappNumber || "2347042776167";

  const [reminders, setReminders] = useState<Record<string, { enabled: boolean; intervalDays: number; timestamp: string; frequency?: string }>>(() => {
    try {
      const saved = localStorage.getItem("caremed_med_reminders");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleReminder = (key: string, days: number, drugName: string, qty: number) => {
    setReminders((prev) => {
      const currentlyEnabled = !!prev[key]?.enabled;
      const updated = {
        ...prev,
        [key]: {
          enabled: !currentlyEnabled,
          intervalDays: days,
          timestamp: new Date().toISOString(),
          frequency: prev[key]?.frequency || "Once daily",
        }
      };
      localStorage.setItem("caremed_med_reminders", JSON.stringify(updated));
      return updated;
    });
  };

  const updateReminderFrequency = (key: string, freq: string) => {
    setReminders((prev) => {
      if (!prev[key]) return prev;
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          frequency: freq,
        }
      };
      localStorage.setItem("caremed_med_reminders", JSON.stringify(updated));
      return updated;
    });
  };

  const calculateReminderDate = (timestampStr: string, days: number) => {
    try {
      let date = new Date();
      if (timestampStr) {
        const parsed = Date.parse(timestampStr);
        if (!isNaN(parsed)) {
          date = new Date(parsed);
        }
      }
      date.setDate(date.getDate() + days);
      return date.toLocaleDateString("en-NG", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + days);
      return fallback.toLocaleDateString("en-NG", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  };


  const getWhatsAppLink = (order: Order) => {
    const targetPhone = normalizePhoneNumber(whatsappNumber);
    const message = `🇳🇬 *${pharmacyName.toUpperCase()} ORDER SEED NOTIFICATION* 🇳🇬\n\nHello ${pharmacyName},\nI just completed a pharmaceutical cart checkout on your clinical platform! Please review my details safety-crosschecked by virtual auditor ${nurseName}.\n\n*Order Invoice Code:* #${order.id}\n*Registered Customer:* ${order.patientName}\n*Total Invoice:* ₦${order.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}\n*Current Status:* ${order.status}\n*Physical Pharmacy Address:* ${pharmacyAddress}\n\n*Prescripted Order Shelf:*\n${order.items.map(i => `• ${i.drug?.name || "Medication"} (${i.quantity}x)`).join("\n")}\n\nPlease audit, dispense, and activate local courier delivery routes. Thank you!`;
    return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
  };

  // Map helper to display status icons and timelines
  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "Reviewing":
        return <Clock className="w-5 h-5 text-amber-500 animate-spin" />;
      case "Dispensed":
        return <CheckCircle2 className="w-5 h-5 text-blue-600" />;
      case "Ready for Pickup":
        return <HeartPulse className="w-5 h-5 text-blue-600" />;
      case "Out for Delivery":
        return <Truck className="w-5 h-5 text-blue-600 animate-bounce" />;
      case "Delivered":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    }
  };

  const getTimelineSteps = (activeStatus: Order["status"]) => {
    const steps = ["Reviewing", "Dispensed", "Out for Delivery", "Delivered"];
    const activeIndex = steps.indexOf(activeStatus);

    return (
      <div className="flex items-center justify-between w-full mt-6">
        {steps.map((step, index) => {
          const isCompleted = index <= activeIndex;
          const isActive = index === activeIndex;

          return (
            <div key={step} className="flex-1 flex flex-col items-center relative">
              {/* Line connector */}
              {index > 0 && (
                <div
                  className={`absolute -left-1/2 top-3 w-full h-[2px] -z-10 ${
                    index <= activeIndex ? "bg-blue-600" : "bg-slate-200"
                  }`}
                />
              )}

              {/* Step Circle */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition ${
                  isActive
                    ? "bg-blue-600 text-white border-blue-600 ring-4 ring-blue-100"
                    : isCompleted
                    ? "bg-blue-100 text-blue-600 border-blue-200"
                    : "bg-white text-slate-400 border-slate-200"
                }`}
              >
                {index + 1}
              </div>

              {/* Label */}
              <span
                className={`text-[10px] sm:text-xs font-bold mt-2 text-center uppercase tracking-wider font-mono ${
                  isActive ? "text-blue-600 font-extrabold" : isCompleted ? "text-slate-655" : "text-slate-400"
                }`}
              >
                {step === "Reviewing" ? "Rx Audit" : step}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Dedicated generator that returns medical guidance based on purchased medications
  const getCareBulletins = (order: Order) => {
    const bulletins = [];

    for (const item of order.items) {
      const drug = item.drug;
      if (drug.id.includes("amox")) {
        bulletins.push({
          drug: drug.name,
          tip: "Bacterial Antibiotics Mandatory: Complete the entire course. Do not stop intermediate doses even if fever subsides, to prevent microbial immunity mutation.",
        });
      }
      if (drug.id.includes("ibu")) {
        bulletins.push({
          drug: drug.name,
          tip: "Gastrointestinal Advisory: Highly recommended to ingest this NSAID with meals or milk. Avoid taking duplicate dose with Aspirin or other blood thinners.",
        });
      }
      if (drug.id.includes("pseudo")) {
        bulletins.push({
          drug: drug.name,
          tip: "Circulatory Caution: Monitor heart levels regularly. Take your final dosage at least 4 hours before bedtime to prevent stimulation, sleep disruption, or high blood pressure spikes.",
        });
      }
      if (drug.id.includes("ben")) {
        bulletins.push({
          drug: drug.name,
          tip: "Somnolence Alert: Causes drowsiness. Never drive, cycle, or operate machinery after dosage. Highly recommended for nighttime ingestion only.",
        });
      }
      if (drug.id.includes("met")) {
        bulletins.push({
          drug: drug.name,
          tip: "Dietary & Kidney Reminder: Ensure kidney health monitoring with a clinician. Take during dinner, and restrict alcohol to prevent critical lactic acidosis spikes.",
        });
      }
      if (drug.id.includes("lisin")) {
        bulletins.push({
          drug: drug.name,
          tip: "Continuous BP Tracker: Monitor cardiovascular pressure weekly. Report severe dry coughs or face swelling to a clinic immediately.",
        });
      }
    }

    return bulletins;
  };

  return (
    <div id="orders-page-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-slate-50 text-slate-800 min-h-[calc(100vh-4rem)]">
      
      <div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight-extrabold">
          Order Tracking & Wellness Reminders
        </h1>
        <p className="text-sm text-slate-500 mt-1 font-mono font-bold uppercase tracking-wider text-[10px]">
          Live Smart Dispatch Pipeline • Dynamic Medication Guidelines
        </p>
      </div>

      {orders.length > 0 ? (
        <div className="space-y-8 max-w-4xl">
          {orders.map((order) => {
            const careBulletins = getCareBulletins(order);

            return (
              <div
                key={order.id}
                className="bg-white border border-slate-205 rounded-2xl overflow-hidden shadow-sm hover:border-slate-300 transition duration-150"
              >
                {/* Header: ID, date, status */}
                <div className="bg-slate-50 p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-mono text-slate-450 uppercase tracking-widest block font-bold">
                      Order Transaction ID
                    </span>
                    <span className="font-mono text-sm font-black text-slate-700">
                      #{order.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[10px] font-mono text-slate-450 uppercase tracking-widest block font-bold">
                        Placed On
                      </span>
                      <span className="text-xs text-slate-600 font-bold">{order.timestamp}</span>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-xl shadow-sm">
                      {getStatusIcon(order.status)}
                      <span className="text-xs font-bold text-slate-805 uppercase font-mono tracking-wider">
                        {order.status === "Reviewing" ? "Rx Audit" : order.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-6">
                  
                  {/* Pipeline diagram */}
                  <div className="bg-slate-50/50 p-4 border border-slate-150 rounded-xl">
                    {getTimelineSteps(order.status)}
                  </div>

                  {/* WhatsApp Funnel CTA */}
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/65 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono font-extrabold text-emerald-850 tracking-wider bg-emerald-100/80 px-2 py-0.5 rounded inline-block">
                        🟢 WhatsApp Order Funnel
                      </span>
                      <p className="text-xs text-slate-700 font-medium">
                        Send this order directly to {pharmacyName} on WhatsApp to instantly alert our duty pharmacist and speed up your clinical review and delivery!
                      </p>
                    </div>
                    <a
                      id={`whatsapp-funnel-${order.id}`}
                      href={getWhatsAppLink(order)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition duration-200 shadow-md shadow-emerald-600/15 shrink-0 select-none cursor-pointer"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.457h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      <span>Share on WhatsApp</span>
                    </a>
                  </div>

                  {/* Items Invoice & Cost breakdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    
                    {/* List items */}
                    <div className="space-y-4">
                      <span className="block text-[11px] font-bold text-slate-450 uppercase tracking-wider font-mono">
                        Items Purchased & Refill Reminders
                      </span>
                      {order.items.map((item) => {
                        const drug = item.drug;
                        const isPrescription = drug.requiresPrescription;
                        
                        // Check if it matches a special chronic disease keyword
                        const nameLower = drug.name.toLowerCase();
                        const categoryLower = drug.category.toLowerCase();
                        const isCardio = categoryLower.includes("cardio") || categoryLower.includes("cardiovascular") || nameLower.includes("pressure") || nameLower.includes("lisin");
                        const isEndocrine = categoryLower.includes("diabetes") || categoryLower.includes("endocrine") || nameLower.includes("metformin") || nameLower.includes("insulin");
                        const isHiv = nameLower.includes("hiv") || nameLower.includes("prep") || nameLower.includes("antiretroviral") || nameLower.includes("tenofovir") || nameLower.includes("dolutegravir");
                        
                        // Setup automatic default days based on quantity and type
                        let defaultPeriod = 30;
                        let typeLabel = "Standard Refill Cycle";
                        
                        if (isCardio) {
                          defaultPeriod = 30;
                          typeLabel = "Cardiovascular BP Maintenance";
                        } else if (isEndocrine) {
                          defaultPeriod = 30;
                          typeLabel = "Diabetes Glycemic Cycle";
                        } else if (isHiv) {
                          defaultPeriod = 30;
                          typeLabel = "Viral Therapy Maintenance";
                        } else if (categoryLower.includes("antibiotics") || nameLower.includes("amox")) {
                          defaultPeriod = 7;
                          typeLabel = "Antimicrobial Course Track";
                        } else {
                          defaultPeriod = 15;
                          typeLabel = "As-Needed Health Tracker";
                        }
                        
                        const totalDays = defaultPeriod * item.quantity;
                        const reminderKey = `${order.id}_${drug.id}`;
                        const activeReminder = reminders[reminderKey];
                        const isEnabled = !!activeReminder?.enabled;

                        return (
                          <div key={drug.id} className="p-3 bg-slate-50/75 border border-slate-150/80 rounded-xl space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex gap-2">
                                <span className="text-slate-400 font-mono">[{item.quantity}x]</span>
                                <span className="text-slate-705 font-bold">{drug.name}</span>
                              </div>
                              <span className="font-mono text-blue-650 font-bold">₦{(drug.price * item.quantity).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {isPrescription ? (
                                    <span className="text-[9px] bg-red-100 text-red-700 font-mono font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase">
                                      Chronic/Rx
                                    </span>
                                  ) : (
                                    <span className="text-[9px] bg-slate-100 text-slate-600 font-mono font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase">
                                      OTC Safe
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-500 font-bold">{typeLabel} ({totalDays} days supply)</span>
                                </div>
                                {isEnabled && (
                                  <span className="text-[9px] text-emerald-600 font-mono font-black mt-1">
                                    ✓ Reminder Set: Reorder alerts on {calculateReminderDate(order.timestamp, totalDays)} (every {totalDays} days)
                                  </span>
                                )}
                              </div>

                              <div>
                                <button
                                  type="button"
                                  onClick={() => toggleReminder(reminderKey, totalDays, drug.name, item.quantity)}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 border cursor-pointer select-none ${
                                    isEnabled
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/90 shadow-sm"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                                  }`}
                                >
                                  {isEnabled ? (
                                    <>
                                      <BellRing className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                                      <span>Reminder Active</span>
                                    </>
                                  ) : (
                                    <>
                                      <Bell className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Set Reminder</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Additional custom scheduling options when enabled */}
                            {isEnabled && (
                              <div className="mt-2 p-2 bg-white border border-emerald-100 rounded-lg text-[11px] text-slate-600 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-705">Dosing Frequency:</span>
                                  <select
                                    value={activeReminder.frequency || "Once daily"}
                                    onChange={(e) => updateReminderFrequency(reminderKey, e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                  >
                                    <option value="Once daily">Once daily (e.g., morning)</option>
                                    <option value="Twice daily">Twice daily (morning & night)</option>
                                    <option value="Three times daily">Three times daily</option>
                                    <option value="As needed">As needed (PRN)</option>
                                  </select>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                                  <span>Estimated Remaining Doses:</span>
                                  <span>{item.quantity * 30} doses based on package</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      <div className="flex justify-between items-center pt-2 text-sm text-slate-500">
                        <span>Courier Safe Delivery</span>
                        <span className="font-mono font-medium">₦{order.total > 1000 ? "2,000.00" : "4.99"}</span>
                      </div>
                      <div className="flex justify-between items-center font-bold text-base text-slate-900 pt-2 border-t border-slate-100">
                        <span>Paid Invoice</span>
                        <span className="font-mono text-blue-650">₦{order.total.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Patient care guidelines bulletin */}
                    <div>
                      {careBulletins.length > 0 && (
                        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 space-y-3.5 shadow-sm">
                          <div className="flex items-center gap-2">
                            <HeartPulse className="w-4 h-5 text-blue-600 shrink-0" />
                            <h4 className="font-bold text-blue-650 text-xs uppercase font-mono tracking-wide">
                              Clinical Patient Care Bulletins
                            </h4>
                          </div>

                          <div className="space-y-3">
                            {careBulletins.map((bullet, i) => (
                              <div key={i} className="text-xs leading-relaxed space-y-1">
                                <span className="font-extrabold text-slate-800 block border-b border-slate-100 pb-0.5">
                                  {bullet.drug}
                                </span>
                                <p className="text-slate-600 font-medium">{bullet.tip}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mx-auto max-w-md py-20 text-center bg-white border border-slate-200 rounded-3xl p-8 space-y-4 shadow-sm">
          <p className="text-lg text-slate-800 font-bold">No Order History Found</p>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            You haven&apos;t placed any medical orders yet. Doublecheck your cart and place an order using our secure 24/7 online delivery.
          </p>
        </div>
      )}

    </div>
  );
}
