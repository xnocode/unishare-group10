"use client";

import { useState, useRef, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import "../auth.css";
import { UniShareMark } from "../components/UniShareMark";
import {
  saveClientUser,
  useCurrentUser,
  useRequireAuth,
  type ClientUser,
} from "../lib/user-client";
import {
  validateDepartment,
  validateFullName,
  validateImageUpload,
  validateStudentId,
} from "../lib/validation";

function StudentVerificationContent() {
  const isAuthenticated = useRequireAuth("/student-verification");
  const { user, isHydrated } = useCurrentUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  const emailParam = (searchParams.get("email") || "").trim();
  const universityParam = (searchParams.get("university") || "").trim();
  const email = (emailParam || user?.email || "").trim().toLowerCase();
  const isDemo = Boolean(email) && email === "farhana@std.du.ac.bd";

  const storedDraft = useMemo(() => {
    if (typeof window === "undefined" || !email) return null;
    try {
      const raw = sessionStorage.getItem(`unishare_verify_draft_${email}`);
      return raw ? (JSON.parse(raw) as Record<string, string>) : null;
    } catch {
      return null;
    }
  }, [email]);

  // Form State (user-edited values take precedence over stored defaults cleanly)
  const [editedFullName, setEditedFullName] = useState<string | null>(null);
  const [editedStudentId, setEditedStudentId] = useState<string | null>(null);
  const [department, setDepartment] = useState(
    storedDraft?.department ?? (isDemo ? "Computer Science & Engineering" : user?.department || "")
  );
  const [programme, setProgramme] = useState(
    storedDraft?.programme ?? user?.programme ?? "BSc (Honours)"
  );
  const [session, setSession] = useState(
    storedDraft?.session ?? user?.academicSession ?? "2023–2024"
  );
  const [gender, setGender] = useState(storedDraft?.gender ?? user?.gender ?? "");

  const fullName =
    editedFullName ?? (storedDraft?.fullName || user?.name || (isDemo ? "Farhana Rahman" : ""));
  const setFullName = (val: string) => setEditedFullName(val);
  const university =
    universityParam ||
    user?.university ||
    (isDemo ? "University of Dhaka" : "");
  const studentId =
    editedStudentId ?? (storedDraft?.studentId || user?.studentId || (isDemo ? "2023-114-028" : ""));
  const setStudentId = (val: string) => setEditedStudentId(val);

  // Photos State (do not fake pre-uploaded photos for real users)
  const [idCardFile, setIdCardFile] = useState<{ name: string; size: string; file?: File } | null>(
    isDemo ? { name: "student-id-front.jpg", size: "JPG · 2.4 MB" } : null
  );
  const [faceFile, setFaceFile] = useState<{ name: string; size: string; file?: File } | null>(
    isDemo ? { name: "farhana-face.jpg", size: "JPG · 1.8 MB" } : null
  );

  const [agreed, setAgreed] = useState(isDemo);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const idCardInputRef = useRef<HTMLInputElement | null>(null);
  const faceInputRef = useRef<HTMLInputElement | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  const handleIdCardUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const check = validateImageUpload(file, 4 * 1024 * 1024);
    if (!check.valid) {
      setErrorMsg(check.error || "Invalid student ID image.");
      return;
    }
    setErrorMsg("");
    const ext = file.name.split(".").pop()?.toUpperCase() || "JPG";
    setIdCardFile({
      name: file.name,
      size: `${ext} · ${formatFileSize(file.size)}`,
      file,
    });
  };

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const check = validateImageUpload(file, 4 * 1024 * 1024);
    if (!check.valid) {
      setErrorMsg(check.error || "Invalid face photo.");
      return;
    }
    setErrorMsg("");
    const ext = file.name.split(".").pop()?.toUpperCase() || "JPG";
    setFaceFile({
      name: file.name,
      size: `${ext} · ${formatFileSize(file.size)}`,
      file,
    });
  };

  const handleSaveAndLater = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined" && email) {
      try {
        sessionStorage.setItem(
          `unishare_verify_draft_${email}`,
          JSON.stringify({
            fullName,
            studentId,
            department,
            programme,
            session,
            gender,
          })
        );
      } catch {
        // ignore storage errors
      }
    }
    router.push("/home");
  };

  if (isHydrated && !isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitMsg("");

    const nameCheck = validateFullName(fullName);
    if (!nameCheck.valid) {
      setErrorMsg(nameCheck.error || "Please enter your genuine full name.");
      return;
    }

    const idCheck = validateStudentId(studentId);
    if (!idCheck.valid) {
      setErrorMsg(idCheck.error || "Please enter a valid student ID number.");
      return;
    }

    const deptCheck = validateDepartment(department);
    if (!deptCheck.valid) {
      setErrorMsg(deptCheck.error || "Please enter your genuine department name.");
      return;
    }

    if (!idCardFile || !faceFile) {
      setErrorMsg(
        "Please upload both your student ID card photo and a face photo to continue."
      );
      return;
    }

    if (!agreed) {
      setErrorMsg("Please confirm the verification agreement to continue.");
      return;
    }

    let navigating = false;
    setIsSubmitting(true);
    try {
      let idCardPhotoPath = "";
      let facePhotoPath = "";

      const uploadPrivatePhoto = async (file: File | undefined, kind: "kyc-id" | "kyc-face") => {
        if (!file) return "";
        const fd = new FormData();
        fd.append("kind", kind);
        fd.append("file", file);
        const upRes = await fetch("/api/uploads", {
          method: "POST",
          body: fd,
        });
        const upData = (await upRes.json().catch(() => ({}))) as {
          ok?: boolean;
          path?: string;
          error?: string;
        };
        if (!upRes.ok || !upData.ok) {
          throw new Error(upData.error || "Photo upload failed.");
        }
        return upData.path || "";
      };

      if (idCardFile.file) {
        idCardPhotoPath = await uploadPrivatePhoto(idCardFile.file, "kyc-id");
      }
      if (faceFile.file) {
        facePhotoPath = await uploadPrivatePhoto(faceFile.file, "kyc-face");
      }

      const res = await fetch("/api/auth/student-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName: nameCheck.normalized,
          university: university.trim(),
          studentId: idCheck.normalized,
          department: deptCheck.normalized,
          programme,
          academicSession: session,
          ...(gender ? { gender } : {}),
          idCardFileName: idCardFile.name,
          faceFileName: faceFile.name,
          ...(idCardPhotoPath ? { idCardPhotoPath } : {}),
          ...(facePhotoPath ? { facePhotoPath } : {}),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        user?: ClientUser;
      };

      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "Unable to save student verification details.");
        return;
      }

      if (data.user) {
        saveClientUser(data.user);
      }
      try {
        sessionStorage.removeItem(`unishare_verify_draft_${email}`);
      } catch {
        // ignore storage cleanup errors
      }

      setSubmitMsg(
        "Student ID verified! Activating your campus access..."
      );
      navigating = true;
      setTimeout(() => {
        router.push(
          `/verification-approved?name=${encodeURIComponent(
            nameCheck.normalized
          )}&email=${encodeURIComponent(email)}&university=${encodeURIComponent(
            university.trim() || "University of Dhaka"
          )}&studentId=${encodeURIComponent(idCheck.normalized)}`
        );
      }, 450);
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : "Network error while saving your student details."
      );
    } finally {
      if (!navigating) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="unishare-auth">
      {/* Top Header */}
      <header>
        <div className="wrap">
          <Link href="/" className="logo">
            <UniShareMark size={26} />
            <span>UniShare</span>
          </Link>
          <nav>
            <Link href="/home" className="nav-link">
              Campus Home
            </Link>
            <Link href="/settings" className="btn">
              Settings
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
            <em>Verified &amp; ready</em>
          </li>
        </ol>

        {/* Title and Lead */}
        <h1 style={{ marginTop: "32px", marginBottom: "12px" }}>
          Let’s make it campus official.
        </h1>
        <p className="lead" style={{ maxWidth: "680px", marginBottom: "32px" }}>
          Add your student details and photos to unlock verified Marketplace rentals, Ride Sharing, and Campus Wallet.
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
                      placeholder="Your full name"
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
                    <input id="university" type="text" value={university || "Selected campus"} readOnly />
                    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  </div>
                  <p className="hint">Matched to your university selection.</p>
                </div>

                {/* Student ID */}
                <div className="field-block">
                  <label htmlFor="studentId">Student ID number</label>
                  <div className="field-input">
                    <input
                      id="studentId"
                      type="text"
                      value={studentId}
                      placeholder="e.g., 2023-114-028"
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
                      placeholder="e.g., Computer Science & Engineering"
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
                      <option value="BSS">BSS</option>
                      <option value="LLB">LLB</option>
                      <option value="PharmD">PharmD</option>
                      <option value="BArch">BArch</option>
                      <option value="MBBS">MBBS</option>
                      <option value="Other">Other</option>
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
                      <option value="2025–2026">2025–2026</option>
                      <option value="2024–2025">2024–2025</option>
                      <option value="2023–2024">2023–2024</option>
                      <option value="2022–2023">2022–2023</option>
                      <option value="2021–2022">2021–2022</option>
                      <option value="2020–2021">2020–2021</option>
                    </select>
                  </div>
                </div>

                {/* Gender for ride safety */}
                <div className="field-block" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="sv-gender">Gender (for ride-partner safety filters)</label>
                  <div className="field-input select">
                    <select
                      id="sv-gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="">Prefer not to say</option>
                      <option value="female">Female (enables Women Only ride option)</option>
                      <option value="male">Male (enables Men Only ride option)</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <p className="hint">Private — never displayed on public Marketplace listings.</p>
                </div>
              </div>

              <hr className="divider-line" />

              {/* Photos Section */}
              <div className="photos-section">
                <h2>Your verification photos</h2>
                <p className="sub">
                  JPG, PNG, or WebP, up to 4 MB each. Stored in a private, encrypted campus bucket.
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
                        {idCardFile ? (
                          <span className="up-status-ok">
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M8 12l3 3 5-6" />
                            </svg>
                            Uploaded
                          </span>
                        ) : (
                          <span className="up-status-ok" style={{ color: "#8a5a00" }}>
                            Required
                          </span>
                        )}
                      </div>
                      <div className="fname">
                        {idCardFile ? idCardFile.name : "No ID card selected"}
                      </div>
                      <div className="fsize">
                        {idCardFile ? idCardFile.size : "JPG, PNG or WebP · up to 4 MB"}
                      </div>
                      <button
                        type="button"
                        className="replace-link"
                        onClick={() => idCardInputRef.current?.click()}
                      >
                        {idCardFile ? "Replace photo" : "Upload ID card"}
                      </button>
                      <input
                        ref={idCardInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
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
                        {faceFile ? (
                          <span className="up-status-ok">
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M8 12l3 3 5-6" />
                            </svg>
                            Uploaded
                          </span>
                        ) : (
                          <span className="up-status-ok" style={{ color: "#8a5a00" }}>
                            Required
                          </span>
                        )}
                      </div>
                      <div className="fname">
                        {faceFile ? faceFile.name : "No face photo selected"}
                      </div>
                      <div className="fsize">
                        {faceFile ? faceFile.size : "JPG, PNG or WebP · up to 4 MB"}
                      </div>
                      <button
                        type="button"
                        className="replace-link"
                        onClick={() => faceInputRef.current?.click()}
                      >
                        {faceFile ? "Replace photo" : "Upload face photo"}
                      </button>
                      <input
                        ref={faceInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
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
                  <span>{isSubmitting ? "Verifying..." : "Complete student verification"}</span>
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
                <a href="/home" className="later-link" onClick={handleSaveAndLater}>
                  Save and finish later
                </a>
              </div>

              {errorMsg && (
                <div className="err-banner" role="alert" style={{ marginTop: "18px" }}>
                  {errorMsg}
                </div>
              )}

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
              Need a hand with verification? <Link href="/help">Contact support</Link>
            </p>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <nav>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/help">Get help</Link>
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

