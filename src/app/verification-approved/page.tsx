"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import "../auth.css";

function VerificationApprovedContent() {
  const searchParams = useSearchParams();

  const nameParam = searchParams.get("name") || "Farhana Rahman";
  const universityParam = searchParams.get("university") || "University of Dhaka";
  const emailParam = searchParams.get("email") || "farhana@std.du.ac.bd";
  const studentIdParam = searchParams.get("studentId") || "2023-114-028";

  const firstName = nameParam.split(" ")[0] || "Farhana";

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
        {/* Progress Stepper - All 4 Completed */}
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
          <li className="done">
            <span aria-label="Step 2 completed">
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
            <em>Confirm email</em>
          </li>
          <li className="done">
            <span aria-label="Step 3 completed">
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
            <em>Student verification</em>
          </li>
          <li className="done" aria-current="step">
            <span aria-label="Step 4 completed">
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
            <em style={{ color: "var(--brand)", fontWeight: 700 }}>
              Verification approved
            </em>
          </li>
        </ol>

        {/* Hero Section */}
        <div className="pending-hero">
          <div className="pending-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 3l2.4 1.7 2.9-.1.9 2.7 2.3 1.7-1 2.8 1 2.8-2.3 1.7-.9 2.7-2.9-.1L12 21l-2.4-1.7-2.9.1-.9-2.7-2.3-1.7 1-2.8-1-2.8 2.3-1.7.9-2.7 2.9.1z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1>You’re campus official, {firstName}.</h1>
            <p className="lead">
              Your student verification is approved. Your shared shelf is now open.
            </p>
          </div>
        </div>

        {/* Two-Column Panel */}
        <div className="pending-panel">
          {/* Left Column: Make the most of your campus */}
          <section className="pending-left">
            <span className="status-pill">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12l3 3 5-6" />
              </svg>
              Verification approved
            </span>

            <h2>Make the most of your campus.</h2>

            <div className="next-steps-list">
              <div className="next-step-item">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
                  <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
                </svg>
                <div>
                  <strong>Rent what you need</strong>
                  <p>
                    Find everyday essentials from verified students at {universityParam}.
                  </p>
                </div>
              </div>

              <div className="next-step-item">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 11l4-4 3 2 3-2 4 4-3 3-3 3-3-3-3-3z" />
                  <path d="M7 11l2 2M10 9l2 2" />
                </svg>
                <div>
                  <strong>Lend what you have</strong>
                  <p>List your items and put your spare things to good use.</p>
                </div>
              </div>

              <div className="next-step-item">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 11l1.5-4.5h11L19 11v5H5z" />
                  <circle cx="8" cy="17" r="1.5" />
                  <circle cx="16" cy="17" r="1.5" />
                  <path d="M5 11h14" />
                </svg>
                <div>
                  <strong>Share a ride</strong>
                  <p>
                    Offer a seat or find a car or rickshaw ride with your
                    university community.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Your verified account */}
          <aside className="pending-right">
            <h2>Your verified account</h2>
            <div className="sub-row">
              <small>Student</small>
              <b>{nameParam}</b>
            </div>
            <div className="sub-row">
              <small>University</small>
              <b>{universityParam}</b>
            </div>
            <div className="sub-row">
              <small>University email</small>
              <b>{emailParam}</b>
            </div>
            <div className="sub-row">
              <small>Student ID</small>
              <b>{studentIdParam}</b>
            </div>
            <div className="approved-tags">
              <span>✓ Student ID card approved</span>
              <span>✓ Face photo approved</span>
            </div>
          </aside>
        </div>

        {/* Notice Banner */}
        <div className="shelf-notice">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <div>
            <strong>Only your university. Only verified students.</strong>
            <p>
              You can now rent, lend and share rides within {universityParam}. Items
              and rides from other universities won’t appear in your feed.
            </p>
          </div>
        </div>

        {/* Foot Actions */}
        <div className="pending-foot-actions">
          <div className="left-acts">
            <Link className="btn" href="/">
              <span>Explore my campus</span>
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
            </Link>
            <Link className="logout-link" href="/login">
              Log out
            </Link>
          </div>
          <p className="help-text">
            Have a question? <Link href="#">Contact support</Link>
          </p>
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

export default function VerificationApprovedPage() {
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
      <VerificationApprovedContent />
    </Suspense>
  );
}
