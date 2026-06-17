/**
 * Normalizes phone numbers to standard E.164-like format (such as 2348031234567)
 * targeted for WhatsApp click-to-chat links.
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove spaces, dashes, brackets, other non-numeric chars except '+'
  let processed = phone.replace(/[^\d+]/g, "");
  
  // Format local Nigerian numbers (e.g., beginning with 0) to 234
  if (processed.startsWith("0")) {
    processed = "234" + processed.substring(1);
  } else if (processed.startsWith("+")) {
    processed = processed.substring(1);
  }
  
  return processed;
}

const NIGERIAN_FIRST_NAMES = [
  "Chidi", "Fatima", "Oluwaseun", "Grace", "Emeka", "Aisha", "Tunde", "Chioma", "Abubakar", "Yinka",
  "Ngozi", "Ibrahim", "Yetunde", "Obinna", "Zainab", "Olumide", "Kemi", "Musa", "Efe", "Damilola",
  "Uche", "Aminu", "Funmi", "Chinedu", "Halima", "Segun", "Amaka", "Sani", "Bose", "Kelechi",
  "Mariam", "Femi", "Joy", "Okey", "Ramatu", "Lekan", "Ebere", "Garba", "Rukayat", "Tochukwu"
];

const NIGERIAN_LAST_NAMES = [
  "Okafor", "Yusuf", "Adebayo", "Musa", "Nwachukwu", "Okonkwo", "Ibrahim", "Akinyemi", "Bello", "Eze",
  "Adeyemi", "Danladi", "Ubah", "Suleiman", "Balogun", "Onyema", "Gbadamosi", "Nwosu", "Okeke", "Alabi",
  "Chukwu", "Babangida", "Olayinka", "Igwe", "Soyinka", "Sanusi", "Adetona", "Fashola", "Opara", "Bako",
  "Obasanjo", "Usman", "Aguda", "Falz", "Oshiomhole", "Danjuma", "Tinubu", "Awolowo", "Azikiwe", "Soludo"
];

const ALLERGIES_POOL = [
  "None", "None", "None", "Penicillin", "Sulfa drugs", "Aspirin", "Ibuprofen", "Codeine", 
  "Peanuts", "Seafood", "Lactose intol."
];

const CHRONIC_CONDITIONS_POOL = [
  "None declared", "None declared", "Hypertension", "Type 2 Diabetes", "Asthma", 
  "Hyperlipidemia", "Chronic Migraine", "Osteoarthritis", "Allergic Rhinitis"
];

const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const GENOTYPE_POOL = ["AA", "AA", "AA", "AS", "AS", "AC", "SS"];

export function generateSyntheticProfiles(): any[] {
  const profilesList: any[] = [];
  for (let i = 1; i <= 500; i++) {
    const firstName = NIGERIAN_FIRST_NAMES[i % NIGERIAN_FIRST_NAMES.length];
    const lastName = NIGERIAN_LAST_NAMES[(i * 3 + 7) % NIGERIAN_LAST_NAMES.length];
    const name = `${firstName} ${lastName}`;
    
    const age = ((i * 7 + 13) % 65 + 18).toString(); // Age between 18 and 82
    const gender = i % 2 === 0 ? "Female" : "Male";
    const bloodGroup = BLOOD_GROUPS[(i * 2 + 5) % BLOOD_GROUPS.length];
    const genotype = GENOTYPE_POOL[(i * i + 3) % GENOTYPE_POOL.length];
    
    const allergy = ALLERGIES_POOL[(i * 11 + i) % ALLERGIES_POOL.length];
    const chronic = CHRONIC_CONDITIONS_POOL[(i * 4 + 9) % CHRONIC_CONDITIONS_POOL.length];
    const phoneState = "0" + ((701000000 + (i * 13997)) % 99999999).toString();
    
    // Some profiles have documents
    const docCount = (i % 7 === 0) ? 2 : (i % 11 === 0) ? i % 3 : 0;
    const uploadedDocuments: any[] = [];
    if (docCount > 0) {
      for (let d = 1; d <= docCount; d++) {
        uploadedDocuments.push({
          id: `doc-${i}-${d}`,
          name: `Rx-Prescription-${i}-${d}.pdf`,
          type: "Prescription",
          uploadedAt: `16/06/2026, 0${(10+d)%12}:45`,
          size: `${((i * 45 + 120) % 500 + 100).toFixed(1)} KB`,
          status: (i % 3 === 0) ? "Approved" : "Pending"
        });
      }
    }
    
    profilesList.push({
      name,
      age,
      gender,
      bloodGroup,
      genotype,
      allergies: allergy === "None" ? "" : allergy,
      chronicConditions: chronic === "None declared" ? "" : chronic,
      currentMedications: i % 5 === 0 ? "Atorvastatin 20mg" : i % 5 === 2 ? "Metformin 500mg" : "",
      notes: `Periodic electronic health validation log #${10000 + i}`,
      phoneNumber: phoneState,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@bmedix-client.ng`,
      isConfirmed: i % 4 !== 0, // 75% confirmed/approved
      emergencyContactName: `${NIGERIAN_FIRST_NAMES[(i + 5) % NIGERIAN_FIRST_NAMES.length]} ${lastName}`,
      emergencyContactPhone: "0" + ((702000000 + (i * 17453)) % 99999999).toString(),
      emergencyContactRelation: i % 3 === 0 ? "Spouse" : i % 3 === 1 ? "Sibling" : "Parent",
      uploadedDocuments: uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
      loginHistory: [
        {
          id: `log-${i}`,
          timestamp: `16/06/2026, 05:${(i%40+10)} AM`,
          ip: `197.97.${(i%254)}.${(i * 2)%254}`,
          device: `Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${80 + i%30}.0`,
          status: "Session initialized successfully"
        }
      ]
    });
  }
  return profilesList;
}
