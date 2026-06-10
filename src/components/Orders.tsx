import { Order } from "../types";
import { CheckCircle2, Clock, Landmark, Truck, ShieldAlert, HeartPulse } from "lucide-react";

interface OrdersProps {
  orders: Order[];
}

export default function Orders({ orders }: OrdersProps) {
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

                  {/* Items Invoice & Cost breakdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    
                    {/* List items */}
                    <div className="space-y-3">
                      <span className="block text-[11px] font-bold text-slate-450 uppercase tracking-wider font-mono">
                        Items Purchased
                      </span>
                      {order.items.map((item) => (
                        <div
                          key={item.drug.id}
                          className="flex items-center justify-between pr-4 py-1 border-b border-slate-100 text-sm"
                        >
                          <div className="flex gap-2">
                            <span className="text-slate-400 font-mono">[{item.quantity}x]</span>
                            <span className="text-slate-700 font-medium">{item.drug.name}</span>
                          </div>
                          <span className="font-mono text-blue-650 font-bold">₦{(item.drug.price * item.quantity).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                      
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
