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
