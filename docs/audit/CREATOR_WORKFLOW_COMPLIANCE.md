# Creator Account Creation Flow — Compliance Audit

**Date:** 2026-02-13  
**Reference:** ACCOUNT CREATION FLOW (Full Detailed Specification) — Fanvue-like community app  
**Scope:** Compare actual implementation vs spec steps 1–19

---

## Summary

| Category | Count |
|----------|-------|
| **Implemented** | 3 |
| **Partial** | 5 |
| **Missing** | 11 |

The current creator onboarding flow is a minimal MVP: signup → email verification → login → onboarding status → mock KYC. Most spec steps are **not implemented**.

---

## Actual Flow (Current Implementation)

```
/signup  →  /verify-email  →  /login?next=/onboarding  →  /onboarding  →  /mock-kyc  →  /onboarding (done)
```

- **Signup:** Email + password only; no social auth or motivational content.
- **Verify:** Manual token entry (no real email delivery).
- **Onboarding:** Status checklist + "Start verification" button.
- **KYC:** Redirects to mock-kyc page; Approve/Reject only; no real identity capture.
- **Profile/Handle:** Available in `/settings/profile` but not part of onboarding.

---

## Step-by-Step Audit

### 1. Sign Up Button

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Entry point on header | ✅ | `Navbar.tsx:131` — Link to `/signup` with "Sign up" |
| Entry point on mobile menu | ❌ | No hamburger/mobile menu; Navbar is same layout on mobile |
| CTA styling | Partial | Uses `btn-primary`; no "S'inscrire" French copy |
| French + English copy | ❌ | Only "Sign up" (no "S'inscrire") |

**Files:** `apps/web/components/app/Navbar.tsx`, `apps/web/components/landing/Hero.tsx` (Hero uses "Start as creator")

---

### 2. Authentication Choice

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Google auth | ❌ | Not implemented |
| X (Twitter) auth | ❌ | Not implemented |
| Email + Password option | ✅ | `signup/page.tsx` — email + password form |
| Password rules | Partial | Min 10 chars only; no complexity rules |
| Email validation | ✅ | Zod `z.string().email()` |
| Error messages | ✅ | API errors surfaced via `getApiErrorMessage` |

**Files:** `apps/web/app/signup/page.tsx`

---

### 3. Click "S'inscrire" (Submit Registration)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Submit button behavior | ✅ | Disables during load, shows "Creating…" |
| Backend call | ✅ | `registerCreator()` → `POST /auth/register` |
| Loading state | ✅ | `loading` state, button disabled |
| Error handling | ✅ | Error state, `role="alert"` |
| French copy "S'inscrire" | ❌ | Uses "Create account" |

**Files:** `apps/web/app/signup/page.tsx`

---

### 4. Display Key Motivational Messages

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Carousel or stacked info cards | ❌ | Not present |
| a. Revenus moyen 3000$–10 000$ | ❌ | — |
| b. Plateforme pour tous les créateurs | ❌ | — |
| c. Analytics pour générer plus | ❌ | — |
| d. Gagner 5% par parrainage | ❌ | — |
| e. Vérification instantanée | ❌ | — |

**Note:** Hero has generic copy ("Where creators get paid…") but none of the 5 motivational messages.

---

### 5. CTA — "Commencer à gagner" + Legal Consent

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| CTA "Commencer à gagner" | ❌ | Hero CTA is "Start as creator" |
| Legal consent text | ❌ | Not present |
| Clickable policy links (CGU, AUP, Privacy) | ❌ | — |
| CTA animation/transition | ❌ | — |

---

### 6. Parrainage (Referral) Page

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Referral code input | ❌ | Not implemented |
| Validation (format, existence) | ❌ | — |
| "Passer cette étape" option | ❌ | — |
| Backend support | ❌ | No referral_code / referrer_id in User/Profile |

---

### 7. Country of Residence Slider

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Country selector (dropdown/search) | ❌ | Not in UI |
| Validation | ❌ | — |
| Icons/flags | ❌ | — |
| Backend support | ✅ | `User.country` (String(2)) exists in migration |

---

### 8. AI Creator vs Human Creator Toggle

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| AI Creator / Human Creator toggle | ❌ | Not implemented |
| Tooltips explaining each | ❌ | — |
| Backend support | ❌ | No `is_ai_creator` or similar field |

---

### 9. Content Type (+18 / Normal) Slider

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| +18 vs Normal content options | Partial | Profile has NSFW toggle in settings, not onboarding |
| Age verification logic | ❌ | — |
| Legal disclaimer | ❌ | — |
| Backend support | ✅ | `User.explicit_intent`, `Profile.nsfw` exist |

---

### 10. Profile Naming Page

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Public Display Name (Nom affiché) | Partial | In `/settings/profile`, not onboarding |
| Unique Handle (@username) | Partial | Same as above |
| Live handle availability checker | ❌ | Not implemented |
| Username rules (length, characters) | Partial | API validates; UI shows no live feedback |

**Files:** `apps/web/app/settings/profile/page.tsx` — has handle/display_name but no live check.

---

### 11. Set Subscription Price

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Set price now OR skip | ❌ | Not in onboarding |
| Min/max values | ❌ | — |
| Recommended pricing hints | ❌ | — |

**Note:** Billing/subscription exists for creators (Stripe), but no onboarding step to set price.

---

### 12. Start Identity Verification

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| CTA "Vérifier et commencer à gagner" | ❌ | Uses "Start verification" / "Resume verification" |
| Transition to verification | ✅ | `createKycSession()` → redirect to KYC URL |

**Files:** `apps/web/app/onboarding/page.tsx`

---

### 13. QR Code Verification Page

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Full-page view with QR code | ❌ | Not implemented |
| Instructions text | ❌ | — |
| Loading indicator | ❌ | — |

**Note:** Mock KYC redirects directly to `/mock-kyc`; no QR flow. Real KYC provider would need this.

---

### 14. Consent for Personal Data Processing

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Page explaining data usage | ❌ | Not in flow |
| Accepter / Refuser buttons | ❌ | — |
| Refuse → exit with message | ❌ | — |

---

### 15. ID Document Type Selection

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Passport / ID card / Driver's license | ❌ | Mock KYC has Approve/Reject only |
| Buttons with icons | ❌ | — |

---

### 16. Capture ID Photos

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Front of ID | ❌ | — |
| Back of ID | ❌ | — |
| Upload or camera capture | ❌ | — |
| Real-time validation (blur, glare) | ❌ | — |

---

### 17. Capture Selfie

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Real-time camera | ❌ | — |
| Face detection guide | ❌ | — |

---

### 18. While Verification Occurs (Laptop View)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Message "Le processus a été déplacé sur un autre appareil." | ❌ | — |
| Animation or status indicator | ❌ | — |

---

### 19. After Verification Success

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Redirect to home/dashboard | Partial | Mock KYC redirects to `/onboarding`; shows "All done!" |
| Final success screen | Partial | Onboarding page shows checklist; no dedicated success page |
| Auto-redirect timer | ❌ | — |
| Manual "Go to Dashboard" button | ❌ | No explicit CTA to dashboard |

**Files:** `apps/web/app/onboarding/page.tsx`, `apps/web/app/mock-kyc/page.tsx`

---

## Data Model Alignment

| Spec Field | DB / API | Notes |
|------------|----------|-------|
| Country | `User.country` (String(2)) | Exists; no UI to set it |
| Explicit content intent | `User.explicit_intent` | Exists; no onboarding step |
| AI vs Human | — | Not in schema |
| Referral code | — | Not in schema |
| Handle / Display name | `Profile.handle`, `Profile.display_name` | Set in settings, not onboarding |
| Subscription price | Billing/Stripe | Exists; no onboarding step |

---

## Recommendations

### High priority (core spec compliance)

1. **Auth choice (Step 2):** Add Google and X (Twitter) OAuth; keep email+password; add password rules (complexity).
2. **Motivational messages (Step 4):** Add carousel or stacked cards with the 5 messages.
3. **Legal consent (Step 5):** Add consent block with links to CGU, AUP, Privacy Policy before signup submit.
4. **Onboarding sequence:** Insert pre-KYC steps in order:
   - Referral (optional, skip allowed)
   - Country
   - AI vs Human
   - Content type (+18 / Normal) with age verification
   - Profile naming (handle + display name) with live availability
   - Subscription price (optional, set later)
   - Then identity verification

### Medium priority (verification flow)

5. **QR verification page:** Implement when integrating real KYC provider.
6. **Consent for data processing:** Add Accepter/Refuser before document capture.
7. **ID capture flow:** Implement when real KYC is integrated (document type, front/back photos, selfie).
8. **"While verifying" message:** Show on laptop when user is on mobile KYC.

### Lower priority (Polish)

9. **Bilingual copy:** Add French strings (S'inscrire, Commencer à gagner, etc.).
10. **Mobile menu:** Add hamburger/mobile nav with Sign up.
11. **Success screen:** Dedicated success page with auto-redirect and "Go to Dashboard" button.

---

*End of audit*
