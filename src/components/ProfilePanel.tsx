import { useState, FormEvent } from "react";
import { PatientProfile } from "../types";
import { UserCheck, ShieldAlert, HeartPulse, Sparkles, X } from "lucide-react";

interface ProfilePanelProps {
  currentProfile: PatientProfile | null;
  onSave: (profile: PatientProfile) => void;
  onClose: () => void;
}

export default function ProfilePanel({
  currentProfile,
  onSave,
  onClose,
}: ProfilePanelProps) {
  const [name, setName] = useState(currentProfile?.name || "");
  const [age, setAge] = useState(currentProfile?.age || "");
  const [gender, setGender] = useState(currentProfile?.gender || "Other");
  const [allergies, setAllergies] = useState(currentProfile?.allergies || "");
  const [chronicConditions, setChronicConditions] = useState(
    currentProfile?.chronicConditions || ""
  );
  const [currentMedications, setCurrentMedications] = useState(
    currentProfile?.currentMedications || ""
  );
  const [notes, setNotes] = useState(currentProfile?.notes || "");

  const allergyShortcuts = [
    "Penicillin-class",
    "NSAIDs (Advil/Aspirin)",
    "Sulfa Drugs",
    "Lactose/Dairy",
    "Latex",
  ];

  const conditionShortcuts = [
    "High Blood Pressure",
    "Asthma",
    "Type 2 Diabetes",
    "Stomach Ulcers",
    "Chronic Kidney Disease",
  ];

  const medicationShortcuts = [
    "Warfarin (Blood Thinner)",
    "Lisinopril",
    "Metformin",
    "Albuterol Inhaler",
  ];

  const handleAllergyTagClick = (tag: string) => {
    if (!allergies.includes(tag)) {
      setAllergies((prev) => (prev ? `${prev}, ${tag}` : tag));
    }
  };

  const handleConditionTagClick = (tag: string) => {
    if (!chronicConditions.includes(tag)) {
      setChronicConditions((prev) => (prev ? `${prev}, ${tag}` : tag));
    }
  };

  const handleMedicationTagClick = (tag: string) => {
    if (!currentMedications.includes(tag)) {
      setCurrentMedications((prev) => (prev ? `${prev}, ${tag}` : tag));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name,
      age,
      gender,
      allergies,
      chronicConditions,
      currentMedications,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-white border border-slate-205 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 text-blue-600">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-slate-900 text-base leading-none tracking-tight">
                Personal Patient Clinical Record
              </h3>
              <p className="text-xs text-slate-450 font-mono mt-1.5 block font-bold uppercase tracking-wider text-[9px]">
                Secured locally • Real-Time AI Drug Triage Integration
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-150 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI Banner */}
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex gap-3 text-xs text-slate-700 leading-relaxed font-medium">
            <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
            <p>
              Your clinical safety and allergen details are analyzed locally. When you order medications or speak to <strong>Nurse Sarah</strong>, your active symptoms are safety-audited against this exact profile to catch dangerous drug conflicts automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Name */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-450 mb-1.5 uppercase font-mono tracking-wide">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-205 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm text-slate-800 transition-all shadow-sm placeholder-slate-400"
              />
            </div>

            {/* Age */}
            <div>
              <label className="block text-xs font-bold text-slate-450 mb-1.5 uppercase font-mono tracking-wide">
                Age
              </label>
              <input
                type="number"
                placeholder="Years"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-205 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm text-slate-800 transition-all shadow-sm placeholder-slate-400"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-bold text-slate-450 mb-1.5 uppercase font-mono tracking-wide">
                Biological Sex
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-205 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm text-slate-700 transition-all shadow-sm cursor-pointer"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Allergies Block */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <label className="block text-xs font-bold text-slate-450 uppercase font-mono tracking-wide">
                Allergies & Severe Sensitivities
              </label>
            </div>
            <textarea
              rows={2}
              placeholder="e.g., Penicillin, Aspirin, Shellfish, Dairy products"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-205 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm transition-all shadow-sm placeholder-slate-400 resize-none text-red-700 font-semibold"
            />
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-slate-450 mr-1 uppercase font-mono font-bold">Click to Add:</span>
              {allergyShortcuts.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => handleAllergyTagClick(tag)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase font-mono bg-slate-100 border border-slate-200 text-slate-700 hover:border-red-300 hover:text-red-650 transition cursor-pointer"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Chronic Conditions */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <HeartPulse className="w-4 h-4 text-blue-600" />
              <label className="block text-xs font-bold text-slate-450 uppercase font-mono tracking-wide">
                Chronic Medical Conditions
              </label>
            </div>
            <textarea
              rows={2}
              placeholder="e.g., High Blood Pressure, Asthma, Heart Disease, GERD"
              value={chronicConditions}
              onChange={(e) => setChronicConditions(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-205 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm transition-all shadow-sm placeholder-slate-400 resize-none text-slate-800"
            />
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-slate-450 mr-1 uppercase font-mono font-bold">Click to Add:</span>
              {conditionShortcuts.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => handleConditionTagClick(tag)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase font-mono bg-slate-100 border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-650 transition cursor-pointer"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Current Ongoing Medications */}
          <div>
            <label className="block text-xs font-bold text-slate-450 mb-1.5 uppercase font-mono tracking-wide">
              Current Medications & Supplements
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Lisinopril 10mg once daily, Multi-vitamins, Aspirin daily"
              value={currentMedications}
              onChange={(e) => setCurrentMedications(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-205 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm transition-all shadow-sm placeholder-slate-400 resize-none text-slate-800 font-semibold"
            />
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-slate-450 mr-1 uppercase font-mono font-bold">Click to Add:</span>
              {medicationShortcuts.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => handleMedicationTagClick(tag)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase font-mono bg-slate-100 border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-650 transition cursor-pointer"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-450 mb-1.5 uppercase font-mono tracking-wide">
              Secondary Notes / Special Circumstances
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Currently breastfeeding, lactose sensitive, or looking for mild sleep remedies."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-205 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm transition-all shadow-sm placeholder-slate-400 text-slate-800"
            />
          </div>
        </form>

        {/* Footer actions */}
        <div className="p-5 border-t border-slate-150 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-655 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition cursor-pointer flex items-center gap-2"
          >
            Save Risk Profile
          </button>
        </div>
      </div>
    </div>
  );
}
