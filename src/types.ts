export interface Drug {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string; // Dynamic graphic description
  ingredients: string;
  dosage: string;
  directions: string;
  warnings: string;
  requiresPrescription: boolean;
  description: string;
  stockLevel?: number;
  minStockAlert?: number;
}

export interface PatientProfile {
  name: string;
  age: string;
  gender: string;
  allergies: string;
  chronicConditions: string;
  currentMedications: string;
  notes: string;
  phoneNumber?: string;
  isConfirmed?: boolean; // Clinical approval state for AI Nurse tracker
  nextOfKinName?: string; // Emergency contact full name
  nextOfKinPhone?: string; // Emergency contact phone
  nextOfKinRelation?: string; // Emergency contact relation (e.g., Spouse, Parent)
  membershipId?: string;
  accountStatus?: string;
  pharmacyStatus?: string;
  verificationStatus?: string;
  medicalHistory?: string;
  uploadedDocuments?: Array<{
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
    type: "Prescription" | "Report" | "Laboratory";
    size?: string;
    status?: "Pending" | "Approved" | "Rejected";
  }>;
  customerHistory?: Array<{
    id: string;
    event: string;
    timestamp: string;
    details?: string;
  }>;
  prescriptionHistory?: Array<{
    id: string;
    event: string;
    timestamp: string;
    details?: string;
  }>;
  orderHistory?: Array<{
    id: string;
    orderId: string;
    event: string;
    timestamp: string;
    details?: string;
  }>;
  chatHistory?: Array<{
    id: string;
    timestamp: string;
    topic: string;
    snippet: string;
    messageCount: number;
  }>;
  paymentHistory?: Array<{
    id: string;
    orderId: string;
    reference: string;
    amount: number;
    timestamp: string;
    status: string;
    details?: string;
  }>;
  loginHistory?: Array<{
    id: string;
    timestamp: string;
    ip: string;
    device: string;
    status: string;
  }>;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  conversationId?: string;
  createdAt?: number;
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
  patientPhone?: string;
  auditReport?: string;
}

export interface AdminPermissions {
  viewCustomers: boolean;
  manageInventory: boolean;
  managePrescriptions: boolean;
  reviewConversations: boolean;
  viewReports: boolean;
  sendNotifications: boolean;
  viewSalesData: boolean;
}

export interface AdminRecord {
  id: string; // auth uid
  email: string;
  name?: string;
  role: "Admin" | "Super Admin";
  permissions: AdminPermissions;
  lastLogin?: string;
}

export interface SystemNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "registration" | "prescriptionUpload" | "orderPlaced" | "customerMessage" | "orderUpdate" | "prescriptionApproval" | "prescriptionRejection" | "adminMessage" | "medicationReminder";
  read: boolean;
  timestamp: string;
  createdAt: number;
}


