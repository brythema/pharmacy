export interface Drug {
  id: string;
  name: string;
  category: "Pain Relief" | "Allergy & Cold" | "Cardiovascular" | "Digestive Health" | "Antibiotics" | "Vitamins & Supplements" | "Sleep Aid";
  price: number;
  image: string; // Dynamic graphic description
  ingredients: string;
  dosage: string;
  directions: string;
  warnings: string;
  requiresPrescription: boolean;
  description: string;
}

export interface PatientProfile {
  name: string;
  age: string;
  gender: string;
  allergies: string;
  chronicConditions: string;
  currentMedications: string;
  notes: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface CartItem {
  drug: Drug;
  quantity: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: "Reviewing" | "Dispensed" | "Ready for Pickup" | "Out for Delivery" | "Delivered";
  timestamp: string;
  patientName: string;
  userId?: string;
}
