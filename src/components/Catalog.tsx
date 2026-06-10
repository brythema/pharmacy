import { useState } from "react";
import { Drug } from "../types";
import { DRUG_CATALOG } from "../data/drugs";
import { Search, ShieldAlert, HeartPulse, ShoppingCart, MessageSquare, AlertCircle, Info } from "lucide-react";

interface CatalogProps {
  onAddToCart: (drug: Drug) => void;
  onInquireSafety: (drug: Drug) => void;
}

type CategoryType = "All" | "Pain Relief" | "Allergy & Cold" | "Cardiovascular" | "Digestive Health" | "Antibiotics" | "Vitamins & Supplements";

export default function Catalog({ onAddToCart, onInquireSafety }: CatalogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryType>("All");
  const [showPrescriptionDisclaimer, setShowPrescriptionDisclaimer] = useState<Drug | null>(null);

  const categories: CategoryType[] = [
    "All",
    "Pain Relief",
    "Allergy & Cold",
    "Cardiovascular",
    "Digestive Health",
    "Antibiotics",
    "Vitamins & Supplements",
  ];

  // Filters
  const filteredDrugs = DRUG_CATALOG.filter((drug) => {
    const matchesSearch =
      drug.name.toLowerCase().includes(search.toLowerCase()) ||
      drug.ingredients.toLowerCase().includes(search.toLowerCase()) ||
      drug.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || drug.category === category;
    return matchesSearch && matchesCategory;
  });

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
            Fully Secure • Verified Over-The-Counter & Prescription Pharmacy
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search drugs, active ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-800 transition placeholder-slate-400 shadow-sm"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>
      </div>

      {/* Categories Horizontal Stream */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition-all duration-150 cursor-pointer border ${
              category === cat
                ? "bg-blue-600 border-blue-600 text-white font-extrabold shadow-md"
                : "bg-white border-slate-200 text-slate-655 hover:text-slate-900 hover:border-slate-350 hover:bg-slate-50 shadow-sm"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Dynamic Catalog Grid */}
      {filteredDrugs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 rounded-lg text-[9px] uppercase font-bold tracking-wider font-mono transition-all">
                    <ShieldAlert className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Rx Required</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-lg text-[9px] uppercase font-bold tracking-wider font-mono">
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
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                {/* Price */}
                <div>
                  <span className="block text-[10px] uppercase font-mono text-slate-400 tracking-wider font-semibold">Pharmacy Price</span>
                  <span className="font-mono text-lg font-black text-blue-650">₦{drug.price.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                {/* Actions */}
                <div id="catalog-card-actions" className="flex items-center gap-2">
                  {/* Safety Check button targeting AI Nurse */}
                  <button
                    type="button"
                    onClick={() => onInquireSafety(drug)}
                    className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-blue-600 border border-blue-200 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title="Consult Nurse Sarah safety interactions"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Ask Nurse</span>
                  </button>

                  {/* Add to Cart */}
                  <button
                    type="button"
                    onClick={() => handleAddToCartClick(drug)}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition shadow-md hover:shadow-lg text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5]" />
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
          <p className="text-sm text-slate-500">Try looking up other generic active ingredients, or reset the filters above.</p>
          <button
            onClick={() => {
              setSearch("");
              setCategory("All");
            }}
            className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-mono font-bold border border-blue-200"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Prescription Required Disclaimer Modal */}
      {showPrescriptionDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white border border-slate-205 rounded-2xl shadow-2xl p-6 text-slate-700">
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <AlertCircle className="w-8 h-8" />
              <div>
                <h4 className="font-extrabold text-slate-900 text-lg">Rx Prescription Required</h4>
                <p className="text-[10px] uppercase font-mono tracking-wider font-semibold text-amber-600">H-Medix Regulations</p>
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
                className="px-4 py-2 bg-slate-105 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPrescriptionAndAdd}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition"
              >
                Acknowledge & Add
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
