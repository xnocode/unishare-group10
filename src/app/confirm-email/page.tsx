"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import "../auth.css";

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get email and phone from query params or fallback to the Figma mockup email
  const emailParam = searchParams.get("email");
  const phoneParam = searchParams.get("phone");
  const email = emailParam ? decodeURIComponent(emailParam) : "farhana@std.du.ac.bd";

  const [digits, setDigits] = useState<string[]>(["4", "8", "2", "", "", ""]);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus the first empty digit box on load
    const firstEmptyIndex = digits.findIndex((d) => d === "");
    if (firstEmptyIndex !== -1 && inputsRef.current[firstEmptyIndex]) {
      inputsRef.current[firstEmptyIndex]?.focus();
    }
  }, []);

  const handleDigitChange = (index: number, value: string) => {
    setErrorMsg("");
    setInfoMsg("");

    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const nextDigits = [...digits];
      nextDigits[index] = "";
      setDigits(nextDigits);
      return;
    }

    // Single character input
    const char = cleaned.slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = char;
    setDigits(nextDigits);

    // Auto-advance to next input
    if (index < 5 && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;

    const nextDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      if (pasted[i]) {
        nextDigits[i] = pasted[i];
      }
    }
    setDigits(nextDigits);

    // Focus the box after the pasted length or the last box
    const nextFocusIndex = Math.min(pasted.length, 5);
    inputsRef.current[nextFocusIndex]?.focus();
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    const fullCode = digits.join("");
    if (fullCode.length < 6) {
      setErrorMsg("Please enter all 6 digits of the confirmation code.");
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setInfoMsg("Email confirmed successfully! Proceeding to Step 3 Student verification...");
      setTimeout(() => {
        const nextQuery = new URLSearchParams({ email });
        if (phoneParam) nextQuery.set("phone", phoneParam);
        router.push(`/student-verification?${nextQuery.toString()}`);
      }, 500);
    }, 600);
  };

  const handleResend = () => {
    setErrorMsg("");
    setInfoMsg(`A fresh 6-digit confirmation code has been sent to ${email}.`);
  };

  return (
    <div className="unishare-auth">
      {/* Top Header */}
      <header>
        <div className="wrap">
          <Link href="/" className="logo">
            <svg
              width="22"
              height="14"
              viewBox="0 0 22 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              aria-hidden="true"
            >
              <circle cx="6.5" cy="7" r="4.5" />
              <circle cx="15.5" cy="7" r="4.5" />
            </svg>
            <span>UniShare</span>
          </Link>
          <nav>
            <Link href="/login" className="nav-link">
              Log in
            </Link>
            <Link href="/register" className="btn">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="wrap">
        {/* Progress Stepper */}
        <ol className="steps" aria-label="Sign-up progress">
          <li className="done">
            <span aria-label="Step 1 completed">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden="true"
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
            <em>Create account</em>
          </li>
          <li className="on" aria-current="step">
            <span>2</span>
            <em>Confirm email</em>
          </li>
          <li>
            <span>3</span>
            <em>Student verification</em>
          </li>
          <li>
            <span>4</span>
            <em>Review pending</em>
          </li>
        </ol>

        {/* 2-Column Grid */}
        <div className="grid">
          {/* Left Column */}
          <section>
            <div className="badge" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="5" width="18" height="14" rx="1.5" />
                <path d="M3 6l9 7 9-7" />
                <path d="M9 14.5l2 2 4-4" />
              </svg>
            </div>

            <h1>
              A small check.
              <br />
              A safer campus.
            </h1>

            <p className="lead">
              Confirming your university email helps keep UniShare a place for
              students, not outsiders.
            </p>

            <div className="next-box">
              <p className="eyebrow">UP NEXT: GET VERIFIED</p>
              <h3>Keep your student ID handy.</h3>
              <p>
                You’ll add your student details, a clear photo of your student ID
                card, and a face photo for review.
              </p>
            </div>
          </section>

          {/* Right Column: Check Your Inbox Card */}
          <section className="card" aria-labelledby="confirm-title">
            <h2 id="confirm-title">Check your inbox</h2>
            <p className="sent">We sent a 6-digit code to</p>
            <p className="email-target">{email}</p>
            <Link href="/register" className="diff-link">
              Use a different email
            </Link>

            <form onSubmit={handleConfirm} noValidate style={{ marginTop: "24px" }}>
              <label className="l" htmlFor="c-0">
                6-digit confirmation code
              </label>

              <div className="codes" onPaste={handlePaste}>
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`c-${idx}`}
                    ref={(el) => {
                      inputsRef.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    placeholder="—"
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    aria-label={`Digit ${idx + 1}`}
                  />
                ))}
              </div>

              <p className={`hint ${errorMsg ? "error" : ""}`}>
                {errorMsg || "Enter the code exactly as it appears in your email."}
              </p>

              <button
                className="btn btn-lg"
                type="submit"
                disabled={isVerifying}
                style={{ marginTop: "16px" }}
              >
                <span>{isVerifying ? "Verifying..." : "Confirm email"}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  aria-hidden="true"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>

              {infoMsg && (
                <div className="ok" role="status" style={{ marginTop: "14px" }}>
                  {infoMsg}
                </div>
              )}

              <p className="center" style={{ marginTop: "20px" }}>
                Didn’t receive it? Check your spam folder.
              </p>

              <button
                type="button"
                className="resend-btn"
                onClick={handleResend}
              >
                Resend code
              </button>

              <div className="private-banner">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                <div>
                  <strong>Your email stays private</strong>
                  <p>
                    We use it to confirm your university, not to display it on your
                    listings.
                  </p>
                </div>
              </div>
            </form>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <nav>
            <Link href="#">Privacy</Link>
            <Link href="#">Terms</Link>
            <Link href="#">Get help</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<div className="unishare-auth"><div className="wrap" style={{ padding: "80px 0", textAlign: "center" }}>Loading...</div></div>}>
      <ConfirmEmailContent />
    </Suspense>
  );
}

