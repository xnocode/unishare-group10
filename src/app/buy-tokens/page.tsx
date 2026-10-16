"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNavbar from "../components/AppNavbar";
import "./buy-tokens.css";

interface PackageOption {
  tokens: number;
  tag: string;
  desc: string;
}

const PACKAGES: PackageOption[] = [
  {
    tokens: 100,
    tag: "A little top-up",
    desc: "Keep a few extra tokens ready for your next campus plan.",
  },
  {
    tokens: 250,
    tag: "Ready for the week",
    desc: "A comfortable top-up for more borrowing and shared journeys.",
  },
  {
    tokens: 500,
    tag: "More room to share",
    desc: "Stock up your wallet for the campus plans ahead.",
  },
];

export default function BuyTokensPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTokens, setSelectedTokens] = useState(250);
  const [selectedPayment, setSelectedPayment] = useState("bKash");
  const [senderPhone, setSenderPhone] = useState("017XXXXXXXX");
  const [trxId, setTrxId] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem("unishare_logged_in") === "true";
      if (!loggedIn) {
        router.replace("/login?redirect=/buy-tokens");
      } else {
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.error(e);
      router.replace("/login?redirect=/buy-tokens");
    }
  }, [router]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("unishare_logged_in");
      localStorage.removeItem("unishare_user");
      document.cookie = "unishare_logged_in=; path=/; max-age=0";
    } catch (err) {
      console.error(err);
    }
    router.push("/login");
  };

  const handlePackageSelect = (tokens: number) => {
    setSelectedTokens(tokens);
    setCurrentStep(2);
    triggerToast(`Selected ${tokens} tokens package`);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxId.trim()) {
      triggerToast("Please enter your payment Transaction ID (TrxID)");
      return;
    }
    setCurrentStep(5);
    triggerToast("Payment submitted for review!");
  };

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#ffffff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <p style={{ color: "#0b5d5b", fontWeight: 600 }}>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="unishare-buy-tokens">
      <AppNavbar
        activeNav="wallet"
        onLogout={handleLogout}
        onSos={() =>
          triggerToast("Emergency Campus SOS: Campus security contacted.")
        }
      />

      {/* Main Content */}
      <main>
        {/* Breadcrumbs */}
        <div className="crumbs">
          <Link href="/home">Home</Link>
          <svg
            viewBox="0 0 10 10"
            fill="none"
            stroke="#0b5d5b"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 2l3 3-3 3" />
          </svg>
          <Link href="/wallet" className="t">
            Wallet
          </Link>
          <svg
            viewBox="0 0 10 10"
            fill="none"
            stroke="#0b5d5b"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 2l3 3-3 3" />
          </svg>
          <span className="cur">Token packages</span>
        </div>

        {/* Title Row */}
        <div className="title-row">
          <div>
            <h1>Token packages</h1>
            <p className="sub-title">
              Choose how many tokens you’d like to add to your wallet.
            </p>
          </div>
          <span className="pill">500 available tokens</span>
        </div>

        {/* Campus Banner */}
        <div className="campus">
          <div className="l">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0b5d5b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
              <path d="M8.5 12l2.5 2.5 4.5-5" />
            </svg>
            <b>University of Dhaka</b>
            <span>
              Your wallet for sharing with verified students on your campus.
            </span>
          </div>
          <div className="r">Verified student</div>
        </div>

        {/* 5-Step Stepper */}
        <div className="stepper">
          <div
            className={`step ${currentStep === 1 ? "on" : currentStep > 1 ? "done" : ""}`}
            onClick={() => setCurrentStep(1)}
          >
            <span className="n">{currentStep > 1 ? "✓" : "1"}</span>
            Package
          </div>
          <div className="bar" />

          <div
            className={`step ${currentStep === 2 ? "on" : currentStep > 2 ? "done" : ""}`}
            onClick={() => setCurrentStep(2)}
          >
            <span className="n">{currentStep > 2 ? "✓" : "2"}</span>
            Order review
          </div>
          <div className="bar" />

          <div
            className={`step ${currentStep === 3 ? "on" : currentStep > 3 ? "done" : ""}`}
            onClick={() => setCurrentStep(3)}
          >
            <span className="n">{currentStep > 3 ? "✓" : "3"}</span>
            Payment method
          </div>
          <div className="bar" />

          <div
            className={`step ${currentStep === 4 ? "on" : currentStep > 4 ? "done" : ""}`}
            onClick={() => setCurrentStep(4)}
          >
            <span className="n">{currentStep > 4 ? "✓" : "4"}</span>
            Submit details
          </div>
          <div className="bar" />

          <div className={`step ${currentStep === 5 ? "on" : ""}`}>
            <span className="n">5</span>
            Verification
          </div>
        </div>

        {/* Step 1: Package Selection */}
        {currentStep === 1 && (
          <>
            <h2 className="sec">Pick your next top-up</h2>
            <p className="note">
              Illustrative token quantities. Your external payment amount is shown
              at checkout.
            </p>

            <div className="cards">
              {/* 100 Tokens */}
              <div
                className={`card ${selectedTokens === 100 ? "sel" : ""}`}
                onClick={() => setSelectedTokens(100)}
              >
                <div className="top">
                  <span className="tag">A little top-up</span>
                  {selectedTokens === 100 && (
                    <span className="badge">Selected</span>
                  )}
                </div>
                <div className="coins">
                  <svg viewBox="0 0 130 64">
                    <ellipse cx="65" cy="52" rx="58" ry="5" fill="#e4efec" />
                    <circle
                      cx="76"
                      cy="27"
                      r="21"
                      fill="#0b5d5b"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="76"
                      cy="27"
                      r="14"
                      fill="none"
                      stroke="#fff"
                      strokeOpacity=".35"
                      strokeWidth="1"
                    />
                    <text
                      x="76"
                      y="34"
                      textAnchor="middle"
                      fontFamily="Schibsted Grotesk,sans-serif"
                      fontWeight="700"
                      fontSize="20"
                      fill="#fff"
                    >
                      u
                    </text>
                    <circle
                      cx="42"
                      cy="35"
                      r="20"
                      fill="#fff"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="42"
                      y="42"
                      textAnchor="middle"
                      fontFamily="Schibsted Grotesk,sans-serif"
                      fontWeight="700"
                      fontSize="20"
                      fill="#0b5d5b"
                    >
                      u
                    </text>
                  </svg>
                </div>
                <div className="amount">100 tokens</div>
                <p className="desc">
                  Keep a few extra tokens ready for your next campus plan.
                </p>
                <hr className="rule" />
                <div className="pay">Payment amount provided at checkout</div>
                <button
                  className={`btn ${selectedTokens === 100 ? "primary" : ""}`}
                  type="button"
                  onClick={() => handlePackageSelect(100)}
                >
                  {selectedTokens === 100
                    ? "Continue with 100 tokens"
                    : "Choose 100 tokens"}
                </button>
              </div>

              {/* 250 Tokens */}
              <div
                className={`card ${selectedTokens === 250 ? "sel" : ""}`}
                onClick={() => setSelectedTokens(250)}
              >
                <div className="top">
                  <span className="tag">Ready for the week</span>
                  {selectedTokens === 250 && (
                    <span className="badge">Selected</span>
                  )}
                </div>
                <div className="coins">
                  <svg viewBox="0 0 130 64">
                    <ellipse cx="65" cy="52" rx="58" ry="5" fill="#e4efec" />
                    <circle
                      cx="92"
                      cy="21"
                      r="20"
                      fill="#fff"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="96"
                      y="28"
                      textAnchor="middle"
                      fontFamily="Schibsted Grotesk,sans-serif"
                      fontWeight="700"
                      fontSize="20"
                      fill="#0b5d5b"
                    >
                      u
                    </text>
                    <circle
                      cx="68"
                      cy="29"
                      r="21"
                      fill="#0b5d5b"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="68"
                      cy="29"
                      r="14"
                      fill="none"
                      stroke="#fff"
                      strokeOpacity=".35"
                      strokeWidth="1"
                    />
                    <text
                      x="68"
                      y="36"
                      textAnchor="middle"
                      fontFamily="Schibsted Grotesk,sans-serif"
                      fontWeight="700"
                      fontSize="20"
                      fill="#fff"
                    >
                      u
                    </text>
                    <circle
                      cx="40"
                      cy="37"
                      r="20"
                      fill="#fff"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="40"
                      y="44"
                      textAnchor="middle"
                      fontFamily="Schibsted Grotesk,sans-serif"
                      fontWeight="700"
                      fontSize="20"
                      fill="#0b5d5b"
                    >
                      u
                    </text>
                  </svg>
                </div>
                <div className="amount">250 tokens</div>
                <p className="desc">
                  A comfortable top-up for more borrowing and shared journeys.
                </p>
                <hr className="rule" />
                <div className="pay">Payment amount provided at checkout</div>
                <button
                  className={`btn ${selectedTokens === 250 ? "primary" : ""}`}
                  type="button"
                  onClick={() => handlePackageSelect(250)}
                >
                  {selectedTokens === 250
                    ? "Continue with 250 tokens"
                    : "Choose 250 tokens"}
                </button>
              </div>

              {/* 500 Tokens */}
              <div
                className={`card ${selectedTokens === 500 ? "sel" : ""}`}
                onClick={() => setSelectedTokens(500)}
              >
                <div className="top">
                  <span className="tag">More room to share</span>
                  {selectedTokens === 500 && (
                    <span className="badge">Selected</span>
                  )}
                </div>
                <div className="coins">
                  <svg viewBox="0 0 130 64">
                    <ellipse cx="65" cy="52" rx="60" ry="5" fill="#e4efec" />
                    <circle
                      cx="108"
                      cy="17"
                      r="19"
                      fill="#fff"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="112"
                      y="24"
                      textAnchor="middle"
                      fontFamily="Schibsted Grotesk,sans-serif"
                      fontWeight="700"
                      fontSize="19"
                      fill="#0b5d5b"
                    >
                      u
                    </text>
                    <circle
                      cx="86"
                      cy="24"
                      r="19"
                      fill="#fff"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="90"
                      y="31"
                      textAnchor="middle"
                      fontFamily="Schibsted Grotesk,sans-serif"
                      fontWeight="700"
                      fontSize="19"
                      fill="#0b5d5b"
                    >
                      u
                    </text>
                    <circle
                      cx="62"
                      cy="31"
                      r="20"
                      fill="#0b5d5b"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="62"
                      cy="31"
                      r="13"
                      fill="none"
                      stroke="#fff"
                      strokeOpacity=".35"
                      strokeWidth="1"
                    />
                    <text
                      x="62"
                      y="38"
                      textAnchor="middle"
                      fontFamily="Schibsted Grotesk,sans-serif"
                      fontWeight="700"
                      fontSize="20"
                      fill="#fff"
                    >
                      u
                    </text>
                    <circle
                      cx="36"
                      cy="38"
                      r="19"
                      fill="#fff"
                      stroke="#0b5d5b"
                      strokeWidth="1.5"
                    />
                    <text
                      x="36"
                      y="45"
                      textAnchor="middle"
                      fontFamily="Schibsted Grotesk,sans-serif"
                      fontWeight="700"
                      fontSize="19"
                      fill="#0b5d5b"
                    >
                      u
                    </text>
                  </svg>
                </div>
                <div className="amount">500 tokens</div>
                <p className="desc">
                  Stock up your wallet for the campus plans ahead.
                </p>
                <hr className="rule" />
                <div className="pay">Payment amount provided at checkout</div>
                <button
                  className={`btn ${selectedTokens === 500 ? "primary" : ""}`}
                  type="button"
                  onClick={() => handlePackageSelect(500)}
                >
                  {selectedTokens === 500
                    ? "Continue with 500 tokens"
                    : "Choose 500 tokens"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Order Review */}
        {currentStep === 2 && (
          <div className="step-panel">
            <h3>Step 2: Order Review</h3>
            <p>Review your token package summary before proceeding to payment.</p>
            <div
              style={{
                background: "var(--teal-faint)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span>Selected Package:</span>
                <b>{selectedTokens} Tokens</b>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span>Campus Rate:</span>
                <span>1 Token = 1 BDT</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span>DU Student Verification Discount:</span>
                <span style={{ color: "var(--teal)", fontWeight: 600 }}>0% fee waiver</span>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "12px 0" }} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "15px",
                }}
              >
                <b>Total Payable:</b>
                <b style={{ color: "var(--teal)", fontSize: "18px" }}>৳{selectedTokens} BDT</b>
              </div>
            </div>
            <div className="step-actions">
              <button
                className="btn"
                type="button"
                onClick={() => setCurrentStep(1)}
              >
                ← Back to packages
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => setCurrentStep(3)}
              >
                Proceed to Payment Method →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Payment Method Selection */}
        {currentStep === 3 && (
          <div className="step-panel">
            <h3>Step 3: Select Payment Method</h3>
            <p>Choose your preferred mobile wallet or bank for token top-up.</p>
            <div className="pay-methods">
              {["bKash", "Nagad", "Rocket"].map((method) => (
                <div
                  key={method}
                  className={`pay-card ${selectedPayment === method ? "active" : ""}`}
                  onClick={() => setSelectedPayment(method)}
                >
                  <b>{method}</b>
                  <small>Instant Mobile Wallet</small>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "var(--teal-soft)",
                borderRadius: "8px",
                padding: "14px",
                marginBottom: "20px",
              }}
            >
              <b style={{ color: "var(--teal)", display: "block", marginBottom: "4px" }}>
                Payment Instructions for {selectedPayment}:
              </b>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                Send <b>৳{selectedTokens}</b> via {selectedPayment} &quot;Send Money&quot; to UniShare Campus Account:{" "}
                <b style={{ color: "var(--ink)" }}>01712-345678</b> (Reference: DU-FARHANA).
              </p>
            </div>

            <div className="step-actions">
              <button
                className="btn"
                type="button"
                onClick={() => setCurrentStep(2)}
              >
                ← Back
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => setCurrentStep(4)}
              >
                Continue with {selectedPayment} →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Submit Payment Details */}
        {currentStep === 4 && (
          <div className="step-panel">
            <h3>Step 4: Submit Payment Verification Details</h3>
            <p>Enter your payment sender number and transaction ID.</p>
            <form onSubmit={handleSubmitPayment}>
              <div className="form-group">
                <label>Your {selectedPayment} Mobile Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 017XXXXXXXX"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Transaction ID (TrxID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9J2K4L1M"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                />
              </div>

              <div className="step-actions">
                <button
                  className="btn"
                  type="button"
                  onClick={() => setCurrentStep(3)}
                >
                  ← Back
                </button>
                <button className="btn primary" type="submit">
                  Submit Payment Details
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 5: Verification Confirmation */}
        {currentStep === 5 && (
          <div className="step-panel" style={{ textAlign: "center", padding: "36px 24px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "var(--teal-soft)",
                color: "var(--teal)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
                fontSize: "24px",
                fontWeight: "bold",
              }}
            >
              ✓
            </div>
            <h3 style={{ fontSize: "22px" }}>Payment Submitted for Review</h3>
            <p style={{ maxWidth: "440px", margin: "8px auto 20px" }}>
              Thank you, Farhana! Your top-up of <b>{selectedTokens} tokens</b> is currently being verified by the DU campus team.
            </p>
            <div
              style={{
                display: "inline-block",
                background: "var(--teal-faint)",
                border: "1px solid var(--line)",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "12px",
                marginBottom: "24px",
              }}
            >
              Reference: <b>DU-{Date.now().toString().slice(-6)}</b> · Status: <span style={{ color: "var(--teal)", fontWeight: 700 }}>Under Review</span>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <Link className="btn primary" href="/wallet">
                Back to Wallet
              </Link>
              <Link className="btn" href="/home">
                Go to Home
              </Link>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="info">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0b5d5b"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <circle cx="12" cy="7.8" r=".6" fill="#0b5d5b" />
          </svg>
          <div>
            <b>Tokens arrive after review, not when you select a package.</b>
            <span>
              Pay externally by bank or mobile payment, submit your payment
              reference, and wait for approval. Your available balance stays at 500
              tokens until the purchase is approved.
            </span>
          </div>
        </div>

        {/* Three Things to Know */}
        <h3 className="know">Three things to know before you buy</h3>
        <div className="know-grid">
          <div className="know-item">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0b5d5b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="10" cy="10" r="6.5" />
              <path d="M10 7v3l2 1.5" />
              <path d="M6.5 17.5L5 21l4-1.5" />
              <path d="M15 15a4 4 0 0 0 5 3" />
            </svg>
            <div>
              <b>Tokens stay on campus</b>
              <p>
                Use your balance for rentals, rides and transfers with verified DU
                students.
              </p>
            </div>
          </div>
          <div className="know-item">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0b5d5b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9.5L12 4l9 5.5" />
              <path d="M4.5 20h15" />
              <path d="M6 11v6M10 11v6M14 11v6M18 11v6" />
            </svg>
            <div>
              <b>External payment is separate</b>
              <p>The payment instructions and amount are provided at checkout.</p>
            </div>
          </div>
          <div className="know-item">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0b5d5b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
              <path d="M8.5 12l2.5 2.5 4.5-5" />
            </svg>
            <div>
              <b>Every payment is reviewed</b>
              <p>
                Only an approved purchase adds tokens to your available wallet
                balance.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="foot">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <nav>
            <Link href="#">Privacy</Link>
            <Link href="#">Terms</Link>
            <Link href="#">Get help</Link>
            <a href="#" onClick={handleLogout}>
              Log out
            </a>
          </nav>
        </div>
      </footer>

      {/* Toast */}
      <div
        className={`toast ${showToast ? "on" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toastMsg}
      </div>
    </div>
  );
}

