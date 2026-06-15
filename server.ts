import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with custom user agent for telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const blacklistedModels = new Set<string>();

// Robust fallback model generator to prevent 503 unavailability outages during spikes in demand
async function generateTextWithFallback(options: {
  contents: any;
  systemInstruction?: string;
  temperature?: number;
  models?: string[];
}) {
  const inputModels = options.models || ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];
  const models = inputModels.filter((m) => !blacklistedModels.has(m));
  
  if (models.length === 0) {
    throw new Error("All integrated clinical intelligence models have been blacklisted or failed to respond.");
  }

  let lastError: any = null;

  for (const model of models) {
    const isFirstModel = (model === models[0]);
    // The "best model" tried first at checkout should have exactly 1 attempt to avoid long wait, falling back to flash immediately
    const maxAttempts = isFirstModel ? 1 : 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const timeoutDuration = isFirstModel ? 25000 : 30000;
      try {
        console.log(`Attempting generateContent using model: ${model} (attempt ${attempt}/${maxAttempts})`);
        
        const apiCall = ai.models.generateContent({
          model: model,
          contents: options.contents,
          config: {
            systemInstruction: options.systemInstruction,
            temperature: options.temperature,
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT_OUTAGE")), timeoutDuration)
        );

        // Race the API call against the timeout promise
        const result = await Promise.race([apiCall, timeoutPromise]);

        if (result && result.text) {
          console.log(`Successfully generated content using model: ${model} on attempt ${attempt}`);
          return result;
        }
      } catch (err: any) {
        lastError = err;
        const errorStr = String(err?.message || "").toLowerCase();
        
        // Quota / Rate limits / RESOURCE_EXHAUSTED check
        const isQuotaExceeded = errorStr.includes("quota") || 
                                errorStr.includes("exhausted") || 
                                errorStr.includes("429") || 
                                errorStr.includes("limit: 0") ||
                                err?.status === "RESOURCE_EXHAUSTED" ||
                                err?.statusCode === 429;

        if (isQuotaExceeded) {
          console.warn(`Model ${model} is out of quota. Blacklisting and bypassing this model for future requests.`);
          blacklistedModels.add(model);
          break; // Fallback to next model immediately
        }

        console.warn(`Model ${model} request failed on attempt ${attempt}:`, err?.message || err);

        if (err?.message === "TIMEOUT_OUTAGE") {
          console.log(`Model ${model} timed out after ${timeoutDuration}ms. Skipping remaining attempts on this model to fallback immediately.`);
          break; // Fallback to the next model immediately
        }

        if (isFirstModel) {
          console.log(`First model (${model}) encountered an error. Falling back immediately without extra retries.`);
          break; // Fallback to the next model immediately
        }

        const isTransient = err?.status === 503 || 
                            err?.status === "UNAVAILABLE" ||
                            err?.statusCode === 503 ||
                            errorStr.includes("503") ||
                            errorStr.includes("unavailable") ||
                            errorStr.includes("high demand") ||
                            errorStr.includes("temporary");

        if (isTransient && attempt < maxAttempts) {
          const waitTime = attempt * 500;
          console.log(`Transient retry detected. Sleeping for ${waitTime}ms before next retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          break;
        }
      }
    }
  }

  throw lastError || new Error("All integrated clinical intelligence models failed to respond.");
}

// Nurse Chat Endpoint
app.post("/api/nurse/chat", async (req, res) => {
  try {
    const { messages, profile, pendingDrugContext, tenantConfig } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Missing or invalid messages parameter." });
      return;
    }

    const pharmacyName = tenantConfig?.pharmacyName || "H-Medix";
    const nurseName = tenantConfig?.nurseName || "Nurse Sarah";
    const pharmacyAddress = tenantConfig?.pharmacyAddress || "Abuja, Nigeria";

    // Construct precise system instructions with client context
    let profileContext = `
No personalized medical profile is specified on this active session. This is a generic patient guest inquiry (anonymous/non-registered).
Because the user does not have an active registered account:
- You must answer their general clinical or medical questions in a highly supportive, professional, and comforting manner.
- Crucially, EVERY single response you generate MUST naturally, gracefully, and helpfully direct or bring the user to the ${pharmacyName} Pharmacy portal (e.g., lookup drugs by visiting our "Order Drugs" catalog tab, browse appropriate therapeutic categories, or add medications to their checkout cart).
- Remind them that register/login (linking a secure medical profile) is strongly advised, as it equips you to check drugs automatically for severe contraindications against their personal allergies, chronic conditions, and concurrent meds.
`;
    if (profile && Object.keys(profile).length > 0) {
      profileContext = `
The client is currently logged in with a personalized medical profile. Treat them with deep empathy, addressing them by name if appropriate. Recheck drug compatibility against these clinical details:
- Name: ${profile.name || "N/A"}
- Age: ${profile.age || "N/A"}
- Gender: ${profile.gender || "N/A"}
- Allergies: ${profile.allergies || "No known allergies"}
- Chronic Conditions: ${profile.chronicConditions || "No chronic conditions"}
- Current Medications: ${profile.currentMedications || "No other ongoing medications"}
- Additional Notes: ${profile.notes || "None"}
`;
    }

    let drugFocusContext = "";
    if (pendingDrugContext) {
      drugFocusContext = `
The user is currently examining or inquiring about this specific drug:
- Drug Name: ${pendingDrugContext.name}
- Action/Type: ${pendingDrugContext.category}
- Ingredients: ${pendingDrugContext.ingredients}
- Common Directions: ${pendingDrugContext.directions}
- Warnings: ${pendingDrugContext.warnings}

Proactively check if they can safely use this drug based on their medical profile, and offer helpful, reassuring clinical instructions.
`;
    }

    const systemInstruction = `
You are safe, empathetic, and professional: "${nurseName}", a virtual AI Clinical Nurse specialized in pharmacy consultations and triage at ${pharmacyName} Pharmacy, Nigeria. All prices listed on our portal are in Nigerian Naira (₦).

CRITICAL RESPONSIBILITIES & CONSTRAINTS:
1. **Medical Emergencies**: If the user's inquiry signals a medical emergency (e.g., chest pain, severe breathing trouble, major bleeding, sudden numbness, anaphylaxis), you MUST direct them to local emergency services (such as 112 or local equivalents in Nigeria) or call a care professional immediately, in bold, clinical, comforting terms.
2. **Personalized Safety & Drug-Interaction Auditing**: Use the provided medical profile context to detect severe drug interactions, duplicate therapy, or illness conflicts. For example, if they take blood thinners, warn about NSAIDs (Advil). If they have chronic kidney disease, look out for nephrotoxic compounds. If they are allergic to penicillin, warn if penicillin-type antibiotics are in question.
3. **Conversational Tone**: Sound warm, highly intelligent, precise, and compassionate. Do not sound robotic. Never list instructions blindly; structure your advice beautifully with spacing or lists. Speak in Naira (₦) for any billing discussion.
4. **Professional Medical Disclaimer**: Always speak with authority but maintain a mandatory disclaimer that you are an AI Nurse assisting them and they should consult a prescribing physician or pharmacist for medical decisions.
5. **Call to Action / Routing**: Encourage them to complete their purchase safely online, or to let you audit their cart before check-out, or suggest contacting one of our physical ${pharmacyName} pharmacy locations (such as in ${pharmacyAddress}) for in-person local support. For guest users who are not registered, you MUST tailor every single response with clear call-to-actions that guide them directly to our virtual drug shelves, ordering paths, or account sign-in/registration panels.

ACTIVE CLIENT CLINICAL BACKGROUND:
${profileContext}
${drugFocusContext}
`;

    // Map and sanitize message history to be strictly alternating user/model
    // starting with a "user" message, which the @google/genai SDK requires.
    const rawContents = messages.map((m) => {
      return {
        role: m.role === "assistant" ? "model" : "user",
        text: m.content || "",
      };
    });

    const firstUserIdx = rawContents.findIndex((c) => c.role === "user");
    if (firstUserIdx === -1) {
      res.status(400).json({ error: "The chat session must contain at least one user query." });
      return;
    }
    const filtered = rawContents.slice(firstUserIdx);

    const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    for (const msg of filtered) {
      if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
        contents[contents.length - 1].parts[0].text += "\n" + msg.text;
      } else {
        contents.push({
          role: msg.role as "user" | "model",
          parts: [{ text: msg.text }],
        });
      }
    }

    const response = await generateTextWithFallback({
      contents: contents,
      systemInstruction,
      temperature: 0.7,
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini AI Nurse chat error:", error);
    res.status(500).json({ error: error.message || "An error occurred while calling the AI Nurse service." });
  }
});

// Nurse Cart Safety Audit Route
app.post("/api/nurse/cart-audit", async (req, res) => {
  try {
    const { cartItems, profile, tenantConfig } = req.body;

    if (!cartItems || !Array.isArray(cartItems)) {
      res.status(400).json({ error: "Missing or invalid cartItems parameter." });
      return;
    }

    const pharmacyName = tenantConfig?.pharmacyName || "H-Medix";
    const nurseName = tenantConfig?.nurseName || "Nurse Sarah";

    let profileContext = "No personalized medical profile is specified.";
    if (profile && Object.keys(profile).length > 0) {
      profileContext = `
- Name: ${profile.name || "N/A"}
- Age: ${profile.age || "N/A"}
- Gender: ${profile.gender || "N/A"}
- Allergies: ${profile.allergies || "No known allergies"}
- Chronic Conditions: ${profile.chronicConditions || "No chronic conditions"}
- Current Medications: ${profile.currentMedications || "No other ongoing medications"}
- Additional Notes: ${profile.notes || "None"}
`;
    }

    const cartList = cartItems
      .map(
        (item, index) =>
          `${index + 1}. **${item.name}** (Category: ${item.category}, Ingredients: ${item.ingredients}, Warning: ${item.warnings})`
      )
      .join("\n");

    const systemInstruction = `
You are ${nurseName}, a rigorous AI Clinical Safety Auditor at ${pharmacyName} Pharmacy, Nigeria.
Your job is to run a pharmaceutical interaction and allergy audit on the items in the user's cart against their clinical profile. All transaction billing references are in Nigerian Naira (₦).

Provide a highly organized, professional markdown clinical safety report with three sections:
1. **Clinical Safety Summary**: A clear statement saying whether the combination in the cart is fully safe, has mild warnings, or has severe contraindications.
2. **Personalized Risk Audit & Warning Flags**: Check if any drugs in the cart conflict with:
   - Their listed allergies (e.g., penicillin, NSAID allergy).
   - Their documented chronic conditions (e.g., high blood pressure vs. pseudoephedrine/decongestants, stomach ulcers vs. aspirin/ibuprofen).
   - Their current ongoing medications (drug-drug interactions).
   - Overlap therapy (ordering multiple drugs with the same key active ingredient, e.g. taking Tylenol and DayQuil which both contain acetaminophen, posing a liver protection risk!).
3. **AI Nurse Delivery & Checkout Recommendations**: Actionable clinical guidelines on how to take these medications safely (e.g., taking with food, spacing hours apart), and whether they are cleared to finalize their purchase.

Keep your tone structured, clinical, authoritative yet reassuring. Always include a disclaimer that this is a clinical audit helper and doesn't replace physician consultation.
`;

    const response = await generateTextWithFallback({
      contents: `Please conduct a thorough clinical interaction audit for the following cart items:
${cartList}

Checking against the patient's medical profile:
${profileContext}
`,
      systemInstruction,
      temperature: 0.2,
      models: ["gemini-3.1-pro-preview", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"],
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Nurse safety audit error:", error);
    res.status(500).json({ error: error.message || "An error occurred during the clinical cart audit." });
  }
});

// Configure Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Serving in Development Mode; running Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving in Production Mode; serving static elements...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CareMed fullstack pharmacy server listening on port ${PORT}`);
  });
}

startServer();
