import { BD_UNIVERSITIES, type BdUniversity } from "./bd-universities";

const FAKE_NAME_WORDS = new Set([
  "test",
  "testing",
  "fake",
  "user",
  "demo",
  "admin",
  "administrator",
  "asdf",
  "asdfg",
  "qwerty",
  "zxcv",
  "abcd",
  "abc",
  "xyz",
  "none",
  "null",
  "undefined",
  "unknown",
  "anon",
  "anonymous",
  "sample",
  "example",
  "temp",
  "tempmail",
  "student",
  "name",
  "noname",
  "fuck",
  "shit",
]);

const FAKE_UNIVERSITY_WORDS = new Set([
  "test",
  "testing",
  "fake",
  "asdf",
  "qwerty",
  "demo",
  "none",
  "null",
  "xyz",
  "abcd",
  "sample",
  "example",
  "temp",
  "unknown",
  "random",
  "nothing",
  "na",
  "n/a",
]);

const INSTITUTION_KEYWORDS =
  /\b(university|univ|college|institute|institution|academy|school|medical|polytechnic|engineering|science|technology|textile|agricultural|maritime|madrasah|madrasha|bishwabidyalay|biswabidyalay|vishwavidyalaya)\b/i;

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findListedUniversityConflict(
  rawName: string
): BdUniversity | undefined {
  const norm = normalizeForMatch(rawName);
  if (!norm) return undefined;

  return BD_UNIVERSITIES.find((uni) => {
    if (normalizeForMatch(uni.name) === norm) return true;
    if (normalizeForMatch(uni.shortName) === norm) return true;
    return (uni.aliases ?? []).some(
      (alias) => normalizeForMatch(alias) === norm
    );
  });
}

export function validateFullName(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = normalizeText(raw);
  if (normalized.length < 3 || normalized.length > 70) {
    return {
      valid: false,
      normalized,
      error: "Enter your real full name (3–70 characters).",
    };
  }

  if (/\d/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Full name cannot contain numbers.",
    };
  }

  if (/[@/:\\]/.test(normalized) || !/^[\p{L}.'\-\s]+$/u.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Use letters, spaces, dots, or hyphens only.",
    };
  }

  if (/(.)\1{3,}/iu.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Please enter a valid real name (no repeated character spam).",
    };
  }

  const words = normalized
    .split(" ")
    .map((w) => w.replace(/^[.'-]+|[.'-]+$/g, ""))
    .filter(Boolean);

  if (words.length < 2) {
    return {
      valid: false,
      normalized,
      error: "Enter both your first and last name (e.g., Fahim Tajwar).",
    };
  }

  const meaningfulWords = words.filter((w) => w.length >= 2);
  if (meaningfulWords.length < 2) {
    return {
      valid: false,
      normalized,
      error: "Enter a complete first and last name.",
    };
  }

  const allFake = words.every((w) => FAKE_NAME_WORDS.has(w.toLowerCase()));
  const anyExplicitFake = words.some((w) =>
    ["fake", "asdf", "qwerty", "test", "testing", "noname"].includes(
      w.toLowerCase()
    )
  );
  if (allFake || anyExplicitFake) {
    return {
      valid: false,
      normalized,
      error: "Please enter your real name — placeholder/test names are not allowed.",
    };
  }

  return { valid: true, normalized };
}

export function validateCustomUniversityName(raw: string): {
  valid: boolean;
  normalized: string;
  conflict?: BdUniversity;
  error?: string;
} {
  const normalized = normalizeText(raw);
  if (normalized.length < 6 || normalized.length > 120) {
    return {
      valid: false,
      normalized,
      error: "Enter your full university or college name (at least 6 characters).",
    };
  }

  const conflict = findListedUniversityConflict(normalized);
  if (conflict) {
    return {
      valid: false,
      normalized,
      conflict,
      error: `${conflict.name} is already in our verified list — select it from the list and use your @${conflict.domains[0]} email.`,
    };
  }

  if (/[@/:\\]/.test(normalized) || /(https?:\/\/|www\.)/i.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Enter the institution name only (not an email or URL).",
    };
  }

  if (/(.)\1{3,}/i.test(normalized) || !/[A-Za-z]{2,}/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Enter a valid institution name without random characters.",
    };
  }

  const words = normalized
    .split(" ")
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);

  if (
    words.length === 0 ||
    words.every((w) => FAKE_UNIVERSITY_WORDS.has(w.toLowerCase())) ||
    words.some((w) => ["asdf", "qwerty", "fake", "test"].includes(w.toLowerCase()))
  ) {
    return {
      valid: false,
      normalized,
      error: "Please enter your real university or college name.",
    };
  }

  const hasKeyword = INSTITUTION_KEYWORDS.test(normalized);
  const alphaWords = words.filter((w) => /^[A-Za-z]{2,}$/.test(w));
  if (words.length < 2 && !hasKeyword) {
    return {
      valid: false,
      normalized,
      error: "Enter the full university/college name (e.g., Dhaka City College).",
    };
  }

  if (!hasKeyword && alphaWords.length < 2) {
    return {
      valid: false,
      normalized,
      error:
        "Include the full official name (e.g., University, College, or Institute).",
    };
  }

  return { valid: true, normalized };
}

export function validatePasswordChoice(password: string): {
  valid: boolean;
  error?: string;
} {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    return {
      valid: false,
      error: "Use at least 8 characters with a letter and a number.",
    };
  }

  const lower = password.trim().toLowerCase();
  const weakSet = new Set([
    "password123",
    "password1",
    "12345678a",
    "123456789a",
    "qwerty123",
    "abcdefgh1",
    "welcome123",
    "letmein123",
  ]);
  if (weakSet.has(lower)) {
    return {
      valid: false,
      error: "Choose a stronger password that isn’t commonly guessed.",
    };
  }

  return { valid: true };
}

export function validateStudentId(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = normalizeText(raw);
  if (normalized.length < 4 || normalized.length > 32) {
    return {
      valid: false,
      normalized,
      error: "Enter your official student ID number (4–32 characters).",
    };
  }

  if (!/^[A-Za-z0-9\-/_ ]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Student ID can only use letters, numbers, hyphens, or slashes.",
    };
  }

  const digitsOnly = normalized.replace(/\D/g, "");
  if (digitsOnly.length < 3) {
    return {
      valid: false,
      normalized,
      error: "Student ID must contain at least 3 numeric digits.",
    };
  }

  const compact = normalized.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  if (/^(.)\1+$/.test(compact) || /^(.)\1+$/.test(digitsOnly)) {
    return {
      valid: false,
      normalized,
      error: "Please enter your genuine student ID (repeated characters are rejected).",
    };
  }

  if (
    ["1234", "12345", "123456", "1234567", "12345678", "987654", "0000"].includes(
      digitsOnly
    ) &&
    compact === digitsOnly
  ) {
    return {
      valid: false,
      normalized,
      error: "Please enter your real student ID, not a placeholder sequence.",
    };
  }

  return { valid: true, normalized };
}

export function validateDepartment(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = normalizeText(raw);
  if (normalized.length < 2 || normalized.length > 80) {
    return {
      valid: false,
      normalized,
      error: "Enter your academic department name (2–80 characters).",
    };
  }

  if (!/^[A-Za-z\s&.,'/-]+$/.test(normalized) || !/[A-Za-z]{2,}/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Enter a valid department name (e.g., CSE or Economics).",
    };
  }

  const lower = normalized.toLowerCase();
  if (
    FAKE_UNIVERSITY_WORDS.has(lower) ||
    /(.)\1{3,}/i.test(normalized) ||
    /\b(test|fake|asdf|qwerty)\b/i.test(lower)
  ) {
    return {
      valid: false,
      normalized,
      error: "Please enter your actual department name.",
    };
  }

  return { valid: true, normalized };
}

export function validateImageUpload(file: File | null | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!file) {
    return { valid: false, error: "Please upload an image file." };
  }

  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const hasValidExt = /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!allowedTypes.has(file.type) && !hasValidExt) {
    return {
      valid: false,
      error: "Only JPG, PNG, or WebP images are accepted.",
    };
  }

  if (file.size < 1024) {
    return {
      valid: false,
      error: "Selected image looks empty or corrupted. Choose a real clear photo.",
    };
  }

  if (file.size > 10 * 1024 * 1024) {
    return {
      valid: false,
      error: "Image must be 10 MB or smaller.",
    };
  }

  return { valid: true };
}

