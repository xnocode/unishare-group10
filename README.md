# UniShare

> **Your campus, one big shared shelf.**  
> A verified university-only platform where students lend and borrow gear with atomic token escrow, coordinate destination-matched shared commutes, manage peer-to-peer wallet transfers, and trigger one-tap emergency SOS alerts.

- **Live Deployment**: [https://unishare.online](https://unishare.online)
- **Hosting**: Vercel (Next.js App Router) backed by PostgreSQL + Supabase Storage

---

## Why Students Choose UniShare

1. **Verified University Network (Zero Random Strangers)**
   - Supports **178 Bangladeshi universities** (`src/app/lib/bd-universities.ts`) across Public, Private, and International institutions, plus custom academic institution verification.
   - Official university domain matching, email OTP confirmation, and two-step Student ID + selfie KYC review ensure users interact strictly with verified campus peers.

2. **All-in-One Campus Utility**
   - **Peer Marketplace (`/marketplace`, `/product-details`, `/my-products`, `/favorites`)**: Rent calculators, lab coats, cameras, books, and electronics by the day instead of buying expensive gear for a single semester, with live search filters, wishlists, and owner listing management.
   - **Campus Ride Matching (`/rides`)**: Match with verified peers traveling along the same route corridor across Dhaka landmarks and university hubs (`TSC, DU`, `Curzon Hall`, `UITS`, `NSU`, `BRAC University`, `UIU`, `AIUB`, `BUET`, `Dhanmondi 32`, `Farmgate`, `Mirpur 10`, etc.), complete with live OpenStreetMap Nominatim search, route-cost split estimates, private coordination chat, and meeting-spot confirmation.
   - **Campus Wallet & Escrow (`/wallet`, `/buy-tokens`)**: Instant token top-ups, peer-to-peer transfers, full transaction ledgers, and refundable deposit escrow built directly into rentals.
   - **Emergency SOS (`/sos`)**: Priority-ranked emergency contacts (`1–5`), one-tap GPS coordinate capture, tokenized live tracking links (`/sos/track/[token]`), call escalation, and WhatsApp/SMS dispatch.

3. **Zero-Friction & Zero-Surprise Economics**
   - Borrowers lock `(days × daily rate) + refundable deposit` up front. Lenders receive payouts only upon confirmed return, and deposits automatically refund if a pending request is declined, cancelled, or returned cleanly.
   - Built responsively across desktop and mobile (`375px+`) with real-time in-app notifications (`/notifications`) and per-user notification & ride-safety defaults (`/settings`).

---

## How UniShare Keeps Users & Data Secure

UniShare applies defense-in-depth across identity verification, session cryptography, cloud file uploads, financial state transitions, ride privacy, and emergency links:

### 1. Identity Verification & Anti-Abuse (`src/app/api/auth/*`, `src/app/lib/otp-service.ts`)
- **Institutional Domain Checks & Duplicate Prevention**: Listed university registrations validate email domains against institutional records (`matchesUniversityEmail`), and `canonicalizeEmail` normalizes Gmail dot/`+tag` aliases to prevent duplicate-account evasion.
- **Hardened 6-Digit Email OTPs**: Generated with `crypto.randomInt(100000, 1000000)`, stored only as `HMAC-SHA256` digests in `AuthVerificationCode`, and validated in constant time (`crypto.timingSafeEqual`). Codes enforce a **15-minute expiry**, **6-attempt brute-force lock**, **30-second resend cooldown**, and guaranteed mail delivery before invalidating prior codes.
- **Session-Bound Student KYC (`/api/auth/student-verification`)**: Requires a valid signed session matching the account email (`403` on cross-account tampering) along with validated student ID, academic department, and ID/selfie uploads (`src/app/lib/validation.ts`).

### 2. Password Cryptography & Session Isolation (`src/app/lib/auth.ts`, `src/app/lib/ride-auth.ts`)
- **Per-User Salted `scrypt` Hashing**: Passwords are hashed using Node's `crypto.scryptSync` (`64`-byte key length) with a fresh `16`-byte random salt (`scrypt$<salt>$<hash>`) and verified via `crypto.timingSafeEqual` to resist timing attacks.
- **Signed `HttpOnly` Session Cookies**: Active sessions (`unishare_session`), verified account recovery cookies (`unishare_verified_account`), and account registries (`unishare_known_accounts`) are signed with `HMAC-SHA256`, embedded with expiration timestamps, and marked `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- **No Header Spoofing in Production**: `getAuthenticatedRideUser` strictly delegates to `getAuthenticatedSessionUser` when `NODE_ENV === "production"`, disabling unsigned `x-user-email` or client-cookie fallbacks so unauthenticated callers receive `401 Unauthorized` across protected APIs.

### 3. Binary Upload Validation & Private KYC Storage (`src/app/lib/cloud-storage.ts`, `src/app/api/uploads/*`)
- **Magic-Byte File Verification**: Every uploaded image requires an active session and passes binary header signature inspection (`detectImageFormat`: JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF....WEBP`) with hard size caps (`2 MB` for marketplace photos, `4 MB` for KYC images)—blocking fake extensions, SVG scripts, and oversized payloads.
- **Private Bucket Isolation for Student IDs**: Student ID card and selfie verification photos are stored exclusively in a **private** Supabase Storage bucket (`kyc-documents`) and referenced only by object keys on `User`, never public URLs. Access goes through `/api/uploads/signed-url`, which authenticates the document owner and issues short-lived **60-second signed preview URLs**.

### 4. Atomic Escrow & Authorization Guards (`src/app/api/marketplace/*`, `src/app/api/wallet/*`)
- **Transactional Ledger Integrity**: Rental escrow locks, approvals, declines, cancellations, returns, and peer token transfers run inside `db.$transaction(...)` atomic transactions updating `User.tokenBalance`, `MarketplaceRental`, `MarketplaceListing`, `WalletTransaction`, and `Notification` together—eliminating partial debits or race conditions.
- **Strict Ownership & State Guards**: Server routes block self-borrowing (`400`), unauthorized rental approvals or item edits/deletes (`403`), insufficient token balances (`400`), and invalid state transitions (`409` when items or requests are no longer available/pending).

### 5. Privacy-First Ride Matching & Dual-Consent GPS (`src/app/api/rides/*`)
- **Strict Gender Policy Enforcement Without Leakage**: Self-declared profile `gender` is never returned in `/api/rides` or `/api/rides/presence` public cards. `women_only` and `men_only` filters are validated server-side against the authenticated requester's profile and return `403` when ineligible.
- **Authenticated Explorer Presence**: `/api/rides/presence` enforces authentication (`401` for anonymous callers) on both `GET` and `POST`, stripping private gender metadata before returning nearby student explorers.
- **Mutual Opt-In Live Trip Tracking**: In `/api/rides/conversations/[id]/tracking/consent`, **both** travel participants must explicitly grant consent (`participant1Consent && participant2Consent`) before live trip telemetry activates (`IN_PROGRESS`), and either participant can pause or end sharing at any time.

### 6. Unguessable Emergency SOS Tracking (`src/app/api/sos/*`)
- **High-Entropy Tracking Tokens**: Live SOS tracking routes (`/sos/track/[token]`) resolve via cryptographically generated unguessable tokens (`generateSecureTrackingToken`) rather than enumerable user/session IDs.
- **Authenticated Dispatch**: WhatsApp emergency alerts (`/api/sos/send-whatsapp`) require authenticated session validation.

---

## Tech Stack

- **Framework**: Next.js 16.4.5 (App Router & Turbopack) + React 19.3 + TypeScript 5
- **Styling & Icons**: Custom CSS Modules / Scoped App Styles, Tailwind CSS v4, Lucide Icons, `Bricolage Grotesque` & `DM Sans` (`next/font/google`)
- **Database & ORM**: Prisma 6 (`PostgreSQL` on Supabase/Neon in production via `DATABASE_URL` + `DIRECT_URL`; automatic `SQLite` local fallback via `scripts/prepare-prisma.js`)
- **Cloud & Communications**:
  - **Storage**: Supabase Storage (`product-photos` public bucket + `kyc-documents` private bucket)
  - **Email**: Resend API (`RESEND_API_KEY`) for transactional OTP verification & password resets
  - **Maps & Geocoding**: Interactive Campus Canvas + OpenStreetMap Nominatim + optional Google Maps Platform (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
  - **SOS Alerts**: Twilio Telephony/SMS & UltraMsg WhatsApp gateway

---

## Getting Started (Local Development)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**  
   Copy `.env.example` to `.env.local` and set your credentials (`DATABASE_URL`, `AUTH_SECRET`, Supabase storage keys, Resend API key, etc.). For quick zero-cloud local testing, `scripts/prepare-prisma.js` automatically switches `prisma/schema.prisma` to `sqlite` if `DATABASE_URL` starts with `file:`.

3. **Sync the database schema & start the dev server**
   ```bash
   npx prisma db push
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

## Verification & Quality Checks

Run lint, static typechecking, and a production build cleanly before committing:

```bash
npm run lint
npx tsc --noEmit
npm run build
```
