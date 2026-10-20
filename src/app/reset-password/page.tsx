"use client";

import { useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import "../auth.css";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailParam = (searchParams.get("email") || "").trim();

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Validation criteria
  const hasMinLength = password.length >= 8;
  const hasLetterAndNumber = /[A-Za-z]/.test(password) && /[0-9]/.test(password);

  // Match state
  let matchStatus = "";
  let matchClass = "";
  if (confirmPassword.length > 0) {
    if (confirmPassword === password) {
      matchStatus = "✓ Passwords match";
      matchClass = "ok";
    } else {
      matchStatus = "Passwords do not match yet.";
      matchClass = "no";
    }
  }

  const handleDigitChange = (index: number, value: string) => {
    setErrorMsg("");
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }
    const next = [...digits];
    next[index] = cleaned.slice(-1);
    setDigits(next);
    if (index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleDigitKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      if (pasted[i]) next[i] = pasted[i];
    }
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleResendResetCode = async () => {
    if (!emailParam || isResending) return;
    setErrorMsg("");
    setIsResending(true);
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailParam, purpose: "PASSWORD_RESET" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "Unable to resend reset code.");
        return;
      }
      setSuccessMsg(`A fresh 6-digit reset code was sent to ${emailParam}.`);
    } catch {
      setErrorMsg("Network error while resending reset code.");
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!emailParam) {
      setErrorMsg("Missing account email. Start from Forgot password first.");
      return;
    }

    const code = digits.join("");
    if (code.length < 6) {
      setErrorMsg("Enter the 6-digit reset code sent to your email.");
      return;
    }

    if (!hasMinLength || !hasLetterAndNumber) {
      setErrorMsg("Password needs 8+ characters, a letter and a number.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailParam,
          code,
          password,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "Unable to reset password.");
        return;
      }

      setSuccessMsg(
        "Password updated successfully! Redirecting you to Log in..."
      );
      setTimeout(() => {
        router.push(`/login?email=${encodeURIComponent(emailParam)}`);
      }, 850);
    } catch {
      setErrorMsg("Network error while resetting password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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

      {/* Main Content */}
      <main className="wrap">
        <div className="grid" style={{ margin: "56px 0 72px" }}>
          {/* Left Column */}
          <section>
            <div className="badge" aria-hidden="true">
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                <circle cx="12" cy="16" r=".8" />
              </svg>
            </div>

            <h1>
              A fresh password.
              <br />
              <span style={{ color: "var(--brand)" }}>The same campus.</span>
            </h1>

            <p className="lead" style={{ marginTop: "24px" }}>
              Choose a new password to secure your account, then get back to
              sharing with your university community.
            </p>

            <div className="next-box" style={{ marginTop: "36px" }}>
              <p className="eyebrow">KEEP YOUR ACCOUNT SAFE</p>
              <h3>Make it yours. Keep it private.</h3>
              <p>
                Choose a password you don’t use on another account. Never share
                it with anyone, even someone from your own university.
              </p>
            </div>
          </section>

          {/* Right Column: Card */}
          <section className="card" aria-labelledby="reset-title">
            <h2 id="reset-title">Set a new password</h2>
            <p className="sub">Reset the password for your UniShare account.</p>
            <div
              style={{
                fontWeight: 700,
                fontSize: "16px",
                marginTop: "8px",
                color: "var(--ink)",
              }}
            >
              {emailParam || "No email provided"}
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {/* 6-digit Reset Code */}
              <div style={{ marginTop: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <label className="l" htmlFor="rc-0" style={{ margin: 0 }}>
                    6-digit reset code
                  </label>
                  {emailParam && (
                    <button
                      type="button"
                      className="univ-manual-toggle"
                      onClick={handleResendResetCode}
                      disabled={isResending}
                    >
                      {isResending ? "Sending..." : "Resend code"}
                    </button>
                  )}
                </div>
                <div className="codes" onPaste={handleDigitPaste}>
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`rc-${idx}`}
                      ref={(el) => {
                        inputsRef.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      placeholder="—"
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      aria-label={`Reset code digit ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* New Password */}
              <div style={{ marginTop: "20px" }}>
                <label className="l" htmlFor="npw">
                  New password
                </label>
                <div className="field">
                  <input
                    id="npw"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter a new password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="ic"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.6 3.3M6.6 6.6A16 16 0 0 0 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 4.2-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                      </svg>
                    )}
                  </button>
                </div>

                <ul className="rules">
                  <li className={hasMinLength ? "ok" : ""}>
                    <svg
                      className="tick"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                    >
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                    At least 8 characters
                  </li>
                  <li className={hasLetterAndNumber ? "ok" : ""}>
                    <svg
                      className="tick"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                    >
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                    Includes a letter and a number
                  </li>
                </ul>
              </div>

              {/* Confirm New Password */}
              <div style={{ marginTop: "22px" }}>
                <label className="l" htmlFor="cpw">
                  Confirm new password
                </label>
                <div className="field">
                  <input
                    id="cpw"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="ic"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.6 3.3M6.6 6.6A16 16 0 0 0 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 4.2-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                      </svg>
                    )}
                  </button>
                </div>
                {matchStatus && (
                  <div className={`match-status ${matchClass}`}>
                    {matchStatus}
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="err" role="status" style={{ marginTop: "12px", color: "var(--err)", fontSize: "14px" }}>
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="ok" role="status" style={{ marginTop: "14px" }}>
                  <p>{successMsg}</p>
                  <Link
                    href="/login"
                    style={{
                      display: "inline-block",
                      marginTop: "8px",
                      textDecoration: "underline",
                      fontWeight: 600,
                    }}
                  >
                    Proceed to log in →
                  </Link>
                </div>
              )}

              <button
                className="btn btn-lg"
                type="submit"
                disabled={isSubmitting}
                style={{ marginTop: "16px", width: "100%" }}
              >
                <span>{isSubmitting ? "Resetting password..." : "Reset password"}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>

              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <Link href="/login" className="back-login-link">
                  Back to log in
                </Link>
              </div>

              {/* Info banner */}
              <div className="card-info-box" style={{ marginTop: "26px" }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  style={{ flexShrink: 0, marginTop: "2px" }}
                  aria-hidden="true"
                >
                  <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <div>
                  <b>A fresh start for your account</b>
                  <p>
                    After resetting your password, log in again with your university
                    email and new password.
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="unishare-auth">
          <div className="wrap" style={{ padding: "80px 0", textAlign: "center" }}>
            Loading...
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
