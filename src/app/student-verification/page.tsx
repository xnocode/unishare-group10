"use client";

import { useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import "../auth.css";

function StudentVerificationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const emailParam = searchParams.get("email");
  const phoneParam = searchParams.get("phone");
  const email = emailParam ? decodeURIComponent(emailParam) : "farhana@std.du.ac.bd";

  // Form State
  const [fullName, setFullName] = useState("Farhana Rahman");
  const [university] = useState("University of Dhaka");
  const [studentId, setStudentId] = useState("2023-114-028");
  const [department, setDepartment] = useState("Computer Science & Engineering");
  const [programme, setProgramme] = useState("BSc (Honours)");
  const [session, setSession] = useState("2023–2024");

  // Photos State
  const [idCardFile, setIdCardFile] = useState<{ name: string; size: string }>({
    name: "student-id-front.jpg",
    size: "JPG · 2.4 MB",
  });
  const [faceFile, setFaceFile] = useState<{ name: string; size: string }>({
    name: "farhana-face.jpg",
    size: "JPG · 1.8 MB",
  });

  const [agreed, setAgreed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  const idCardInputRef = useRef<HTMLInputElement | null>(null);
  const faceInputRef = useRef<HTMLInputElement | null>(null);

  const handleIdCardUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const ext = file.name.split(".").pop()?.toUpperCase() || "JPG";
      setIdCardFile({
        name: file.name,
        size: `${ext} · ${sizeMB} MB`,
      });
    }
  };

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const ext = file.name.split(".").pop()?.toUpperCase() || "JPG";
      setFaceFile({
        name: file.name,
        size: `${ext} · ${sizeMB} MB`,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      alert("Please confirm the verification agreement to continue.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitMsg("Verification details submitted successfully! Moving to Review Pending...");
      setTimeout(() => {
        const nextQuery = new URLSearchParams({
          name: fullName,
          email,
          university,
          studentId,
        });
        if (phoneParam) nextQuery.set("phone", phoneParam);
        router.push(`/verification-pending?${nextQuery.toString()}`);
      }, 500);
    }, 600);
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
          <li className="on" aria-current="step">
            <span>3</span>
            <em>Student verification</em>
          </li>
          <li>
            <span>4</span>
            <em>Review pending</em>
          </li>
        </ol>

        {/* Title and Lead */}
        <h1 style={{ marginTop: "32px", marginBottom: "12px" }}>
          Let’s make it campus official.
        </h1>
        <p className="lead" style={{ maxWidth: "680px", marginBottom: "32px" }}>
          Add your student details and photos. We review every member before they can rent, lend or share a ride.
        </p>

        {/* 2-Column Layout */}
        <div className="student-layout">
          {/* Main Card */}
          <section className="main-form-card">
            <h2>Student details</h2>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-grid2">
                {/* Full name */}
                <div className="field-block">
                  <label htmlFor="fullName">Full name</label>
                  <div className="field-input">
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <p className="hint">As shown on your student ID card.</p>
                </div>

                {/* University */}
                <div className="field-block">
                  <label htmlFor="university">University</label>
                  <div className="field-input locked">
                    <input id="university" type="text" value={university} readOnly />
                    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  </div>
                  <p className="hint">Matched to your university email.</p>
                </div>

                {/* Student ID */}
                <div className="field-block">
                  <label htmlFor="studentId">Student ID number</label>
                  <div className="field-input">
                    <input
                      id="studentId"
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Department */}
                <div className="field-block">
                  <label htmlFor="dept">Department</label>
                  <div className="field-input">
                    <input
                      id="dept"
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Programme */}
                <div className="field-block">
                  <label htmlFor="programme">Programme</label>
                  <div className="field-input select">
                    <select
                      id="programme"
                      value={programme}
                      onChange={(e) => setProgramme(e.target.value)}
                    >
                      <option value="BSc (Honours)">BSc (Honours)</option>
                      <option value="BSc">BSc</option>
                      <option value="MSc">MSc</option>
                      <option value="BBA">BBA</option>
                      <option value="MBA">MBA</option>
                      <option value="BA">BA</option>
                    </select>
                  </div>
                </div>

                {/* Academic session */}
                <div className="field-block">
                  <label htmlFor="session">Academic session</label>
                  <div className="field-input select">
                    <select
                      id="session"
                      value={session}
                      onChange={(e) => setSession(e.target.value)}
                    >
                      <option value="2023–2024">2023–2024</option>
                      <option value="2024–2025">2024–2025</option>
                      <option value="2022–2023">2022–2023</option>
                      <option value="2021–2022">2021–2022</option>
                    </select>
                  </div>
                </div>
              </div>

              <hr className="divider-line" />

              {/* Photos Section */}
              <div className="photos-section">
                <h2>Your verification photos</h2>
                <p className="sub">
                  JPG or PNG, up to 10 MB each. Your photos are only used for review.
                </p>

                <div className="uploads-grid">
                  {/* Student ID Card */}
                  <div>
                    <label className="l" style={{ marginBottom: "8px" }}>
                      Student ID card
                    </label>
                    <div className="up-box">
                      <div className="up-top">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="4" y="3" width="16" height="18" rx="2" />
                          <circle cx="12" cy="10" r="2.5" />
                          <path d="M8 17c.6-1.5 2-2.3 4-2.3s3.4.8 4 2.3" />
                        </svg>
                        <span className="up-status-ok">
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M8 12l3 3 5-6" />
                          </svg>
                          Uploaded
                        </span>
                      </div>
                      <div className="fname">{idCardFile.name}</div>
                      <div className="fsize">{idCardFile.size}</div>
                      <button
                        type="button"
                        className="replace-link"
                        onClick={() => idCardInputRef.current?.click()}
                      >
                        Replace photo
                      </button>
                      <input
                        ref={idCardInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        style={{ display: "none" }}
                        onChange={handleIdCardUpload}
                      />
                    </div>
                    <p className="up-hint">
                      Show your name, photo and student ID clearly. Keep all four corners visible.
                    </p>
                  </div>

                  {/* Face Photo */}
                  <div>
                    <label className="l" style={{ marginBottom: "8px" }}>
                      Face photo
                    </label>
                    <div className="up-box">
                      <div className="up-top">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
                          <path d="M9 10v1M15 10v1M9.5 15c.7.8 1.5 1.2 2.5 1.2s1.8-.4 2.5-1.2" />
                        </svg>
                        <span className="up-status-ok">
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M8 12l3 3 5-6" />
                          </svg>
                          Uploaded
                        </span>
                      </div>
                      <div className="fname">{faceFile.name}</div>
                      <div className="fsize">{faceFile.size}</div>
                      <button
                        type="button"
                        className="replace-link"
                        onClick={() => faceInputRef.current?.click()}
                      >
                        Replace photo
                      </button>
                      <input
                        ref={faceInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        style={{ display: "none" }}
                        onChange={handleFaceUpload}
                      />
                    </div>
                    <p className="up-hint">
                      Face the camera in good light. No sunglasses, masks or filters.
                    </p>
                  </div>
                </div>
              </div>

              {/* Agreement Checkbox */}
              <label className="agree" style={{ marginTop: "26px", marginBottom: "24px" }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>
                  I confirm these details and photos are mine and agree to their use for student verification.
                </span>
              </label>

              {/* Actions */}
              <div className="actions-row">
                <button className="btn" type="submit" disabled={isSubmitting}>
                  <span>{isSubmitting ? "Submitting..." : "Submit for review"}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    aria-hidden="true"
                    style={{ marginLeft: "6px" }}
                  >
                    <path d="M5 12h14m-6-6 6 6-6 6" />
                  </svg>
                </button>
                <Link href="/" className="later-link">
                  Save and finish later
                </Link>
              </div>

              {submitMsg && (
                <div className="ok" role="status" style={{ marginTop: "18px" }}>
                  {submitMsg}
                </div>
              )}
            </form>
          </section>

          {/* Right Sidebar */}
          <aside className="side-col">
            {/* Confirmed Email Note */}
            <div className="side-note">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12l3 3 5-6" />
              </svg>
              <div>
                <strong>University email confirmed</strong>
                <small>{email}</small>
              </div>
            </div>

            {/* Tips Card */}
            <div className="tips-card">
              <h3>A clear photo means a smoother review.</h3>
              <ul>
                <li>Use a current, readable student ID card.</li>
                <li>Make sure your name matches your student details.</li>
                <li>Your face should be clearly visible in both photos.</li>
              </ul>
            </div>

            {/* Campus Protection Note */}
            <div className="side-note">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <div>
                <strong>Your campus only</strong>
                <small>
                  Once approved, you’ll only see items and rides from your own university.
                </small>
              </div>
            </div>

            {/* Help Contact */}
            <p className="help-text">
              Need a hand with verification? <Link href="#">Contact support</Link>
            </p>
          </aside>
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

export default function StudentVerificationPage() {
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
      <StudentVerificationContent />
    </Suspense>
  );
}

