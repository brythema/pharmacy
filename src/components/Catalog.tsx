import { useState, useMemo } from "react";
import { Drug, PatientProfile } from "../types";
import { DRUG_CATALOG } from "../data/drugs";
import { Search, ShieldAlert, HeartPulse, ShoppingCart, MessageSquare, AlertCircle, Info, ArrowLeft, ChevronRight, Grid } from "lucide-react";

interface CatalogProps {
  onAddToCart: (drug: Drug) => void;
  onInquireSafety: (drug: Drug) => void;
  profile: PatientProfile | null;
  onOpenProfile: () => void;
  drugs?: Drug[];
}

type CategoryType = string;

export default function Catalog({ onAddToCart, onInquireSafety, profile, onOpenProfile, drugs }: CatalogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [showPrescriptionDisclaimer, setShowPrescriptionDisclaimer] = useState<Drug | null>(null);

  const activeCatalog = drugs && drugs.length > 0 ? drugs : DRUG_CATALOG;

  // Derive unique categories dynamically from the drug catalog using memoization
  const categories = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(activeCatalog.map((drug) => drug.category))).sort()
    ];
  }, [activeCatalog]);

  // Filters drugs with useMemo
  const filteredDrugs = useMemo(() => {
    const searchValue = search.toLowerCase();
    return activeCatalog.filter((drug) => {
      const matchesSearch =
        drug.name.toLowerCase().includes(searchValue) ||
        drug.ingredients.toLowerCase().includes(searchValue) ||
        drug.description.toLowerCase().includes(searchValue);
      const matchesCategory = category === "All" || drug.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [activeCatalog, search, category]);

  const handleAddToCartClick = (drug: Drug) => {
    if (drug.requiresPrescription) {
      setShowPrescriptionDisclaimer(drug);
    } else {
      onAddToCart(drug);
    }
  };

  const confirmPrescriptionAndAdd = () => {
    if (showPrescriptionDisclaimer) {
      onAddToCart(showPrescriptionDisclaimer);
      setShowPrescriptionDisclaimer(null);
    }
  };

  return (
    <div id="drug-catalog-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-slate-50 text-slate-800 min-h-[calc(100vh-4rem)]">
      
      {/* Catalog Title Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight-extrabold">
            Clinical Medication Portal
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-mono font-bold uppercase tracking-wider text-[10px]">
            Fully Secure • Verified Over-The-Counter &amp; Prescription Pharmacy
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder={category === "All" ? "Search drugs, active components..." : `Search in ${category}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-800 transition placeholder-slate-400 shadow-sm"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>
      </div>

      {/* Global Search Results view / Bento Grid view */}
      {search.trim() !== "" ? (
        <div className="space-y-6">
          {/* Global Search Results Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-blue-50/50 border border-blue-100 p-4 rounded-2xl gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔍</span>
              <div>
                <p className="text-sm font-bold text-slate-950">Global Catalog Search</p>
                <p className="text-xs text-slate-500">Showing match results for &ldquo;<span className="text-slate-800 font-semibold">{search}</span>&rdquo; across all specialties</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-950 border border-slate-200 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer whitespace-nowrap"
            >
              Clear Search
            </button>
          </div>

          {/* Search Result Drug Cards */}
          {filteredDrugs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDrugs.map((drug) => (
                <div
                  key={drug.id}
                  className="group relative flex flex-col justify-between bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-400 hover:shadow-lg transition duration-200 shadow-sm animate-fade-in"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition shrink-0 shadow-sm">
                      {drug.image}
                    </div>
                    
                    {drug.requiresPrescription ? (
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-100 text-red-650 rounded-lg text-[9px] uppercase font-bold tracking-wider font-mono">
                        <ShieldAlert className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Rx Required</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-650 rounded-lg text-[9px] uppercase font-bold tracking-wider font-mono">
                        <span>OTC Safe</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      {drug.category}
                    </span>
                    <h3 className="font-display font-bold text-lg text-slate-905 mt-1 leading-snug tracking-tight">
                      {drug.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {drug.description}
                    </p>

                    <div className="mt-4 p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1.5 text-xs">
                      <div>
                        <span className="font-semibold text-slate-550">Active Compound:</span>{" "}
                        <span className="text-slate-800 font-medium">{drug.ingredients}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-550">Standard Dosage:</span>{" "}
                        <span className="text-slate-800 font-medium">{drug.dosage}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] uppercase font-mono text-slate-400 tracking-wider font-semibold">Pharmacy Price</span>
                        <span className="font-mono text-lg font-black text-blue-650">₦{drug.price.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => onInquireSafety(drug)}
                        className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 text-blue-600 border border-blue-200 transition-all cursor-pointer flex items-center justify-center gap-2 text-xs font-bold"
                        title="Consult Nurse Sarah safety interactions"
                      >
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span>Ask Nurse</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddToCartClick(drug)}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition shadow-md hover:shadow-lg text-xs cursor-pointer flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                        <span>Purchase</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl max-w-lg mx-auto p-8 shadow-sm">
              <p className="text-lg text-slate-805 font-bold mb-2">No matching medications found</p>
              <p className="text-sm text-slate-550">We found zero items matching &ldquo;{search}&rdquo; in our current pharmaceutical vaults.</p>
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-mono font-bold border border-blue-200 transition-all"
              >
                Clear Search &amp; Reset
              </button>
            </div>
          )}
        </div>
      ) : category === "All" ? (
        // SHOW STYLISH BENTO GRID OF SPECIALTIES!
        <div className="space-y-6">
          
          {/* Welcome Specialty Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-md">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 font-black text-8xl select-none hidden md:block tracking-tighter">BMEDIX</div>
            <div className="relative z-10 max-w-3xl">
              <span className="bg-white/20 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full font-mono">
                Browse Directory
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-black mt-2 tracking-tight">
                Welcome to specialized pharmaceutical directories
              </h2>
              <p className="text-xs sm:text-sm text-blue-100 mt-2 leading-relaxed max-w-2xl">
                Select from our curated Bento Specialties below to explore targeted health formulations (Pain Relief, Antibiotics, Antimalarials, Pediatric suspensions, cardiovascular, and more).
              </p>
            </div>
          </div>

          {/* Dynamic Bento Cards Container */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.filter(cat => cat !== "All").map((cat, index) => {
              // Dynamic extraction of products for the preview panel matching user specification
              const catDrugs = activeCatalog.filter(d => d.category === cat);
              const meta = CATEGORY_META_MAP[cat] || {
                emoji: "🩺",
                bgGradient: "from-slate-550/10 to-zinc-550/10 bg-slate-50/10",
                borderColor: "group-hover:border-slate-400 border-slate-200/80",
                badgeBg: "bg-slate-100 text-slate-800",
                badgeText: "text-slate-800",
                accentText: "text-slate-600",
                accentColor: "slate",
                desc: "Explore highly-structured pharmaceutical formulations for targeted clinical health and body vitalization.",
                spanClass: index % 4 === 0 ? "md:col-span-2 lg:col-span-2" : "md:col-span-1 lg:col-span-1"
              };

              return (
                <div
                  key={cat}
                  role="button"
                  tabIndex={0}
                  aria-label={`Explore specialty ${cat}`}
                  onClick={() => setCategory(cat)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setCategory(cat);
                    }
                  }}
                  className={`group relative flex flex-col justify-between overflow-hidden bg-white border ${meta.borderColor} rounded-3xl p-6 transition-[border-color,background-color,box-shadow] duration-300 hover:shadow-xl cursor-pointer ${meta.spanClass}`}
                >
                  <div className="relative">
                    {/* Header: Title and count */}
                    <div className="flex items-center justify-between gap-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${meta.bgGradient} flex items-center justify-center text-3xl group-hover:scale-105 transition-transform duration-300 transform-gpu shadow-sm`}>
                        {meta.emoji}
                      </div>

                      <span className={`px-2.5 py-1 ${meta.badgeBg} font-mono font-black uppercase text-[9px] tracking-wider rounded-lg`}>
                        {catDrugs.length} Products
                      </span>
                    </div>

                    {/* Middle: Specialty info */}
                    <h3 className="font-display font-black text-xl text-slate-900 mt-5 group-hover:text-blue-600 transition-colors duration-200">
                      {cat}
                    </h3>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      {meta.desc}
                    </p>

                    {/* Dynamic Popular preview chips targeting: "like pain killers would have paracetamol, cocodamol..." */}
                    <div className="mt-5 pt-4 border-t border-slate-150">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono mb-2">
                        Common medications:
                      </p>
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        {catDrugs.slice(0, 3).map(d => (
                          <span
                            key={d.id}
                            className="text-[10px] bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg text-slate-700 font-semibold shadow-sm hover:border-slate-350 transition-colors shrink-0 whitespace-nowrap"
                          >
                            {d.image} {d.name.replace(/\s*(?:Tablet|Capsule|Suspension|mg|ml|\d).*$/gi, '')}
                          </span>
                        ))}
                        {catDrugs.length > 3 && (
                          <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-1 rounded-lg flex items-center shrink-0 whitespace-nowrap">
                            +{catDrugs.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & expand visualizer info */}
                  <div className="mt-6 pt-3 flex items-center justify-between text-xs font-bold border-t border-slate-50">
                    <span className={`${meta.accentText} uppercase tracking-wider font-mono text-[10px] flex items-center gap-1 group-hover:translate-x-1.5 transition-transform duration-300 transform-gpu`}>
                      Explore specialty &rarr;
                    </span>
                    <button type="button" className="h-7 w-7 rounded-sm bg-slate-50 group-hover:bg-blue-600 group-hover:text-white transition flex items-center justify-center border border-slate-205">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // SHOW DETAILED PRODUCT LIST FOR SPECIFIC CATEGORY (WITH QUICK BACK NAV!)
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Back to main directories */}
            <button
              type="button"
              onClick={() => setCategory("All")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Back to Specialty Directories</span>
            </button>

            {/* In-view micro links to swap other specialties instantly! */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full sm:max-w-md lg:max-w-xl no-scrollbar">
              {categories.slice(0, 8).map((catName) => (
                <button
                  key={catName}
                  type="button"
                  onClick={() => setCategory(catName)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono transition-all duration-150 cursor-pointer ${
                    category === catName
                      ? "bg-slate-900 text-white font-extrabold shadow-sm"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {catName === "All" ? "Directories" : catName}
                </button>
              ))}
            </div>
          </div>

          {/* Specialty Hero Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{(CATEGORY_META_MAP[category] || { emoji: "🩺" }).emoji}</span>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                  Verified Specialized Formulations
                </span>
              </div>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-slate-950">{category}</h2>
               <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
                 {(CATEGORY_META_MAP[category] || { desc: "Explore highly-structured product formulations for clinical care and patient vitalization." }).desc}
               </p>
            </div>
            <div className="text-left md:text-right shrink-0 bg-slate-50 p-4 rounded-2xl border border-slate-150 min-w-[140px]">
              <span className="block text-[9px] uppercase font-mono font-bold text-slate-405 tracking-wider">Directory Items</span>
              <span className="text-3xl font-black text-slate-900">{filteredDrugs.length}</span>
              <span className="text-xs text-slate-500 block">Formulations Live</span>
            </div>
          </div>

          {/* Specialized Medications Grid! */}
          {filteredDrugs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {filteredDrugs.map((drug) => (
                <div
                  key={drug.id}
                  className="group relative flex flex-col justify-between bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-400 hover:shadow-lg transition duration-200 shadow-sm"
                >
                  {/* Top Row: Symbol and Prescription warning */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition shrink-0 shadow-sm">
                      {drug.image}
                    </div>
                    
                    {drug.requiresPrescription ? (
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-100 text-red-600 rounded-lg text-[9px] uppercase font-bold tracking-wider font-mono">
                        <ShieldAlert className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Rx Required</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-650 rounded-lg text-[9px] uppercase font-bold tracking-wider font-mono">
                        <span>OTC Safe</span>
                      </div>
                    )}
                  </div>

                  {/* Middle block: Name, desc, ingredients */}
                  <div className="mt-4 flex-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-400">
                      {drug.category}
                    </span>
                    <h3 className="font-display font-bold text-lg text-slate-900 mt-0.5 leading-snug tracking-tight">
                      {drug.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {drug.description}
                    </p>

                    {/* Clinical ingredients panel */}
                    <div className="mt-4 p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1.5 text-xs">
                      <div>
                        <span className="font-semibold text-slate-500">Active Compound:</span>{" "}
                        <span className="text-slate-800 font-medium">{drug.ingredients}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Standard Dosage:</span>{" "}
                        <span className="text-slate-800 font-medium">{drug.dosage}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Price and interactive actions */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-3">
                    {/* Price */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] uppercase font-mono text-slate-400 tracking-wider font-semibold">Pharmacy Price</span>
                        <span className="font-mono text-lg font-black text-blue-650">₦{drug.price.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div id="catalog-card-actions" className="flex flex-col gap-2 w-full">
                      {/* Safety Check button targeting AI Nurse */}
                      <button
                        type="button"
                        onClick={() => onInquireSafety(drug)}
                        className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 text-blue-600 border border-blue-200 transition-all cursor-pointer flex items-center justify-center gap-2 text-xs font-bold"
                        title="Consult Nurse Sarah safety interactions"
                      >
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span>Ask Nurse</span>
                      </button>

                      {/* Add to Cart */}
                      <button
                        type="button"
                        onClick={() => handleAddToCartClick(drug)}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition shadow-md hover:shadow-lg text-xs cursor-pointer flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                        <span>Purchase</span>
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl max-w-lg mx-auto p-8 shadow-sm">
              <p className="text-lg text-slate-800 font-bold mb-2">No matching medications found</p>
              <p className="text-sm text-slate-500">We currently have no available items matching search filters inside this category.</p>
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-mono font-bold border border-blue-200"
              >
                Reset Search Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Prescription Required Disclaimer Modal */}
      {showPrescriptionDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 text-slate-700">
            <div className="flex items-center gap-3 text-amber-500 mb-4 font-display">
              <AlertCircle className="w-8 h-8" />
              <div>
                <h4 className="font-extrabold text-slate-900 text-lg">Rx Prescription Required</h4>
                <p className="text-[10px] uppercase font-mono tracking-wider font-semibold text-amber-600">Bmedix Regulations</p>
              </div>
            </div>

            <p className="text-sm text-slate-650 mb-4 leading-relaxed">
              <strong>{showPrescriptionDisclaimer.name}</strong> is a prescription-only medication. Under localized clinical laws, we require a dentist or doctor&apos;s signed prescription.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 mb-5 flex gap-2 text-xs text-slate-500 leading-relaxed">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p>
                You can add this to your pharmacy cart, but during checkout/dispensing, you will need to display your credential details or bring the paper copy. Our clinical AI will still perform safety drug auditing.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPrescriptionDisclaimer(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPrescriptionAndAdd}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition"
              >
                Acknowledge &amp; Add
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Visual layout configuration grid mapping dynamically for design consistency
const CATEGORY_META_MAP: Record<string, {
  emoji: string;
  bgGradient: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  accentText: string;
  accentColor: string;
  desc: string;
  spanClass: string;
}> = {
  "Pain Relief": {
    emoji: "⚡",
    bgGradient: "from-amber-500/10 to-orange-500/10 hover:from-amber-500/15 hover:to-orange-500/15 bg-amber-50/10",
    borderColor: "group-hover:border-amber-400 border-slate-200/80",
    badgeBg: "bg-amber-100 text-amber-850",
    badgeText: "text-amber-800",
    accentText: "text-amber-600",
    accentColor: "amber",
    desc: "Fast-acting relief for headaches, joint inflammation, muscular tension, and acute pain triggers.",
    spanClass: "md:col-span-2 lg:col-span-2"
  },
  "Antibiotics": {
    emoji: "🧬",
    bgGradient: "from-blue-500/10 to-indigo-500/10 hover:from-blue-500/15 hover:to-indigo-500/15 bg-blue-50/10",
    borderColor: "group-hover:border-blue-400 border-slate-200/80",
    badgeBg: "bg-blue-100 text-blue-800",
    badgeText: "text-blue-800",
    accentText: "text-blue-600",
    accentColor: "blue",
    desc: "Targeted antimicrobial formulations optimized to resolve clinical bacterial infections.",
    spanClass: "md:col-span-1 lg:col-span-1"
  },
  "Cardiovascular": {
    emoji: "❤️",
    bgGradient: "from-rose-500/10 to-pink-500/10 hover:from-rose-500/15 hover:to-rose-500/15 bg-rose-50/10",
    borderColor: "group-hover:border-rose-400 border-slate-200/80",
    badgeBg: "bg-rose-100 text-rose-805",
    badgeText: "text-rose-800",
    accentText: "text-rose-600",
    accentColor: "rose",
    desc: "Blood pressure moderation, circulation control, beta-blockers, and cardiovascular safety.",
    spanClass: "md:col-span-1 lg:col-span-1"
  },
  "Digestive Health": {
    emoji: "🍃",
    bgGradient: "from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/15 hover:to-teal-500/15 bg-emerald-50/10",
    borderColor: "group-hover:border-emerald-400 border-slate-200/80",
    badgeBg: "bg-emerald-100 text-emerald-800",
    badgeText: "text-emerald-800",
    accentText: "text-emerald-600",
    accentColor: "emerald",
    desc: "Gastric acid controllers, anti-reflux agents, and clinical digestive motility regulators.",
    spanClass: "md:col-span-1 lg:col-span-2"
  },
  "Vitamins & Supplements": {
    emoji: "✨",
    bgGradient: "from-yellow-500/10 to-amber-500/10 hover:from-yellow-500/15 hover:to-amber-500/15 bg-yellow-50/10",
    borderColor: "group-hover:border-yellow-405 border-slate-200/80",
    badgeBg: "bg-yellow-100 text-yellow-800",
    badgeText: "text-yellow-800",
    accentText: "text-yellow-600",
    accentColor: "yellow",
    desc: "Therapeutic daily micronutrients, bones strength support, and metabolic wellness minerals.",
    spanClass: "md:col-span-1 lg:col-span-1"
  },
  "Diabetes & Endocrine": {
    emoji: "🩸",
    bgGradient: "from-cyan-500/10 to-sky-500/10 hover:from-cyan-500/15 hover:to-sky-500/15 bg-cyan-50/10",
    borderColor: "group-hover:border-cyan-400 border-slate-200/80",
    badgeBg: "bg-cyan-100 text-cyan-800",
    badgeText: "text-cyan-800",
    accentText: "text-cyan-600",
    accentColor: "cyan",
    desc: "Glycemic safety regulators, endocrine therapies, and direct glucose control.",
    spanClass: "md:col-span-1 lg:col-span-1"
  },
  "Respiratory": {
    emoji: "🫁",
    bgGradient: "from-pink-500/10 to-purple-500/10 hover:from-pink-500/15 hover:to-purple-500/15 bg-pink-50/10",
    borderColor: "group-hover:border-pink-400 border-slate-200/80",
    badgeBg: "bg-pink-100 text-pink-850",
    badgeText: "text-pink-800",
    accentText: "text-pink-650",
    accentColor: "pink",
    desc: "Bronchodilator inhalers, allergy shields, and respiratory wellness therapy.",
    spanClass: "md:col-span-2 lg:col-span-1"
  },
  "Antimalarial": {
    emoji: "🦟",
    bgGradient: "from-red-500/10 to-orange-500/10 hover:from-red-500/15 hover:to-red-500/15 bg-red-50/10",
    borderColor: "group-hover:border-red-400 border-slate-200/80",
    badgeBg: "bg-red-100 text-red-800",
    badgeText: "text-red-800",
    accentText: "text-red-650",
    accentColor: "red",
    desc: "Targeted systems for parasite eradication, malaria prophylaxis, and fever management.",
    spanClass: "md:col-span-1 lg:col-span-1"
  },
  "Allergy & Cold": {
    emoji: "❄️",
    bgGradient: "from-violet-500/10 to-purple-500/10 hover:from-violet-500/15 hover:to-purple-500/15 bg-violet-50/10",
    borderColor: "group-hover:border-violet-400 border-slate-200/80",
    badgeBg: "bg-violet-100 text-violet-800",
    badgeText: "text-violet-800",
    accentText: "text-violet-600",
    accentColor: "violet",
    desc: "Allergen blocks, non-drowsy antihistamines, nasal solutions, and dynamic cold relief.",
    spanClass: "md:col-span-1 lg:col-span-1"
  },
  "Women's Health": {
    emoji: "🌸",
    bgGradient: "from-fuchsia-500/10 to-rose-500/10 hover:from-fuchsia-500/15 hover:to-rose-500/15 bg-fuchsia-50/10",
    borderColor: "group-hover:border-fuchsia-400 border-slate-200/80",
    badgeBg: "bg-fuchsia-100 text-fuchsia-800",
    badgeText: "text-fuchsia-805",
    accentText: "text-fuchsia-600",
    accentColor: "fuchsia",
    desc: "Critical maternal care, pelvic vitality, birth control, and family hormone support.",
    spanClass: "md:col-span-1 lg:col-span-2"
  },
  "Dermatology": {
    emoji: "🧴",
    bgGradient: "from-orange-500/10 to-amber-500/10 hover:from-orange-500/15 hover:to-orange-500/15 bg-orange-50/10",
    borderColor: "group-hover:border-orange-400 border-slate-200/80",
    badgeBg: "bg-orange-100 text-orange-850",
    badgeText: "text-orange-950",
    accentText: "text-orange-700",
    accentColor: "orange",
    desc: "Steroid applications, healing skin ointments, and advanced clinical protective barriers.",
    spanClass: "md:col-span-1 lg:col-span-1"
  },
  "Eye & ENT Care": {
    emoji: "👁️",
    bgGradient: "from-teal-500/10 to-cyan-500/10 hover:from-teal-500/15 hover:to-teal-500/15 bg-teal-50/10",
    borderColor: "group-hover:border-teal-405 border-slate-200/80",
    badgeBg: "bg-teal-100 text-teal-800",
    badgeText: "text-teal-800",
    accentText: "text-teal-600",
    accentColor: "teal",
    desc: "Medicated ophthalmic eye drops, cerumen ear dissolvers, and sinus sprays.",
    spanClass: "md:col-span-1 lg:col-span-1"
  }
};
