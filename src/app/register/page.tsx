"use client";

import { useState } from "react";
import Link from "next/link";
import "../auth.css";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");
    setBannerError("");

    const trimmedEmail = email.trim();
    let isValid = true;

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setEmailError("Enter a valid university email address.");
      isValid = false;
    } else {
      setEmailError("");
    }

    // Password validation: at least 8 chars, must include letter and number
    const passwordValid =
      password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
    if (!passwordValid) {
      setPasswordError("Use at least 8 characters with a letter and a number.");
      isValid = false;
    } else {
      setPasswordError("");
    }

    // Confirm password matching
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password.");
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords don’t match.");
      isValid = false;
    } else {
      setConfirmPasswordError("");
    }

    if (!isValid) return;

    if (!agreed) {
      setBannerError(
        "Please agree to the Terms of use and Privacy policy to continue."
      );
      return;
    }

    // Success response matching the sample flow
    setSuccessMessage(`Next: we’ll send a 6-digit code to ${trimmedEmail}.`);
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
        {/* Progress Steps */}
        <ol className="steps" aria-label="Sign-up progress">
          <li className="on" aria-current="step">
            <span>1</span>
            <em>Create account</em>
          </li>
          <li>
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
          {/* Left Column: Community Info & Value Prop */}
          <section>
            <p className="kicker">JOIN YOUR CAMPUS COMMUNITY</p>
            <h1>
              Create your account{" "}
              <em>
                and start sharing <br className="hidden md:inline" />
                with your campus.
              </em>
            </h1>
            <p className="lead">
              Use your university email to create an account, then borrow, lend,
              and connect with students from your own campus.
            </p>

            <div className="panel">
              <h2>What you can do after signup</h2>
              <p>
                Once your account is created, you can browse items, request a
                pickup, and connect with students from your university.
              </p>
              <ol>
                <li>
                  <b>1</b>
                  <span>
                    Borrow books, gear, and other items from students on your campus.
                  </span>
                </li>
                <li>
                  <b>2</b>
                  <span>
                    Lend what you no longer need and help someone else on campus.
                  </span>
                </li>
                <li>
                  <b>3</b>
                  <span>
                    Share rides, notes, and campus resources with people you trust.
                  </span>
                </li>
              </ol>
            </div>
            <p className="note">
              Your university email helps keep the community safe and local.
            </p>
          </section>

          {/* Right Column: Sign Up Card */}
          <section className="card" aria-labelledby="form-title">
            <h2 id="form-title">Create your campus account</h2>
            <p className="sub">
              Use your university email to create your account. We’ll send a
              6-digit code to confirm it’s really you.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {/* University Email */}
              <label className="l" htmlFor="email">
                University email address
              </label>
              <div className="field">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  placeholder="name@university.edu"
                  autoComplete="email"
                  required
                />
                <span className="ic static" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </span>
              </div>
              <p className={`hint ${emailError ? "error" : ""}`}>
                {emailError || "Use the email address issued by your university."}
              </p>

              {/* Password */}
              <label className="l" htmlFor="pw">
                Create a password
              </label>
              <div className="field">
                <input
                  id="pw"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
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
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-3.2 3.7M6.6 6.7A16 16 0 0 0 3 12s4 6 9 6c1.5 0 2.8-.4 4-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                    </svg>
                  )}
                </button>
              </div>
              <p className={`hint ${passwordError ? "error" : ""}`}>
                {passwordError ||
                  "Use at least 8 characters and include a letter and a number."}
              </p>

              {/* Confirm Password */}
              <label className="l" htmlFor="pw2">
                Confirm your password
              </label>
              <div className="field">
                <input
                  id="pw2"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) setConfirmPasswordError("");
                  }}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
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
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-3.2 3.7M6.6 6.7A16 16 0 0 0 3 12s4 6 9 6c1.5 0 2.8-.4 4-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                    </svg>
                  )}
                </button>
              </div>
              <p
                className={`hint ${confirmPasswordError ? "error" : ""}`}
                style={{ marginBottom: "16px" }}
              >
                {confirmPasswordError}
              </p>

              {/* Terms Checkbox */}
              <label className="agree">
                <input
                  type="checkbox"
                  id="agree"
                  checked={agreed}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    if (bannerError) setBannerError("");
                  }}
                />
                <span>
                  I agree to the <Link href="#">Terms of use</Link> and{" "}
                  <Link href="#">Privacy policy</Link> and confirm I am a
                  university student.
                </span>
              </label>

              {/* Submit Button */}
              <button className="btn btn-lg" type="submit">
                <span>Continue</span>
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

              <p className="center">
                We’ll send a 6-digit code to confirm your university email address.
              </p>

              {bannerError && (
                <div className="err-banner" role="alert">
                  {bannerError}
                </div>
              )}

              {successMessage && (
                <div className="ok" role="status">
                  {successMessage}
                </div>
              )}

              <p className="center big">
                Already have an account? <Link href="/login">Log in</Link>
              </p>
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
