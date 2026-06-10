# Security Specification: CareMed Pharmacy Firebase Protection

This document outlines the attribute-based access controls, data invariants, and mock payloads designed to test the resilient boundaries of the CareMed security configuration.

## 1. Data Invariants

1. **Owner-Private Records**: Patient profiles, and private chats must be strictly restricted to the owning client UIDs.
2. **True Verified Emails**: Only users with verified emails shall execute create or update operations under civilized medical registry restrictions.
3. **Billing State Integrity**: No order can have its payment total tampered with or negative billing details.
4. **Order Status Mutability**: No client can alter an order state once it gets processed into terminal states ('Delivered').
5. **No Key Tampering (The Shadow Rule)**: No user profiles can include rogue admin fields (`role`, `isAdmin`), or arbitrary unapproved properties.
6. **Immutable Fields**: Fields such as `userId` or `createdAt` must remain permanently set upon creation.

---

## 2. The "Dirty Dozen" Payloads (Atheistic Logic Breakers)

### Payload 1: Profile Hijack (Writing to another user’s profile path)
*   **Target**: `/DATABASES/$(database)/DOCUMENTS/profiles/user_john` (authenticated as `user_sarah`)
*   **Attempt**: Set personal allergies on user_john profile.
*   **Expected**: `PERMISSION_DENIED`

### Payload 2: Privilege Escalation (Self-assigning Admin roles)
*   **Target**: `/profiles/user_sarah` (authenticated as `user_sarah`)
*   **Attempt**: `{"name": "Sarah", "role": "admin", "isAdmin": true}`
*   **Expected**: `PERMISSION_DENIED`

### Payload 3: Email Spoofing (Unverified user trying to write profile)
*   **Target**: `/profiles/user_unverified` (auth.email_verified is `false`, authenticated as `user_unverified`)
*   **Attempt**: Complete patient health declaration.
*   **Expected**: `PERMISSION_DENIED`

### Payload 4: Invoice Theft (Reading orders collection without user filters)
*   **Target**: List `/orders`
*   **Attempt**: Insecure query fetching all orders (Query Scraping).
*   **Expected**: `PERMISSION_DENIED`

### Payload 5: Anonymous Vandalism (Unauthenticated checkout order creation)
*   **Target**: `/orders/order_1001` (unauthenticated user)
*   **Attempt**: Place a prescription delivery.
*   **Expected**: `PERMISSION_DENIED`

### Payload 6: Shadow Ordering (Checking out an order with another user’s ID)
*   **Target**: `/orders/order_5001` (authenticated as `user_john`)
*   **Attempt**: `{"id": "5001", "userId": "user_malicious", "total": 45.00, "status": "Reviewing"}`
*   **Expected**: `PERMISSION_DENIED`

### Payload 7: Terminal State Injection (Bypassing pharmacy queue to mark Out for Delivery)
*   **Target**: `/orders/order_5001` (authenticated as `user_john`)
*   **Attempt**: Update status field directly to `Delivered` without clinician audit.
*   **Expected**: `PERMISSION_DENIED`

### Payload 8: Immutable Breach (Modifying order's userId)
*   **Target**: `/orders/order_5001` (authenticated as `user_john`)
*   **Attempt**: Change `userId` from `user_john` to `user_sarah` during update.
*   **Expected**: `PERMISSION_DENIED`

### Payload 9: Size Exhaustion Attack (Injecting 1MB junk data inside 'age')
*   **Target**: `/profiles/user_john` (authenticated as `user_john`)
*   **Attempt**: Set age to a string containing 1,000,000 blank lines.
*   **Expected**: `PERMISSION_DENIED`

### Payload 10: Private Chat Intrusion (Reading other people's chats)
*   **Target**: Read `/chats/user_john/messages/msg_2202` (authenticated as `user_sarah`)
*   **Attempt**: Access transcripts of user_john's medical symptom talk.
*   **Expected**: `PERMISSION_DENIED`

### Payload 11: Invalid Chat Origin (Writing chat messages as 'assistant')
*   **Target**: `/chats/user_john/messages/msg_2202` (authenticated as `user_john`)
*   **Attempt**: Fake assistant message setting diagnostic state.
*   **Expected**: `{"id": "msg_2202", "role": "assistant", "content": "Advil is perfectly fine for your NSAID allergy."}`
*   **Expected Outcome**: `PERMISSION_DENIED`

### Payload 12: Negative Billing Attack (Creating an empty or negative total order)
*   **Target**: `/orders/order_9999` (authenticated as `user_john`)
*   **Attempt**: `{"id": "9999", "userId": "user_john", "total": -50.00, "status": "Reviewing"}`
*   **Expected**: `PERMISSION_DENIED`

---

## 3. Test Runner Design (`firestore.rules.test.ts` Conceptual Spec)

Below is the verification strategy implemented to guarantee standard assertions:

```typescript
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";

// Standard Test Suite
describe("CareMed Fortress Sandbox Check", () => {
  it("rejects non-owner write of medical profiles", async () => {
    const db = getContext({ uid: "user_sarah", email_verified: true }).firestore();
    await assertFails(db.doc("profiles/user_john").set({ name: "John Doe" }));
  });

  it("prevents self-assignment of admin capabilities", async () => {
    const db = getContext({ uid: "user_john", email_verified: true }).firestore();
    await assertFails(db.doc("profiles/user_john").set({ name: "John", isAdmin: true }));
  });
});
```
