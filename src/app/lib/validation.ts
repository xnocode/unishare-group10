import { BD_UNIVERSITIES, type BdUniversity } from "./bd-universities";

const FAKE_NAME_WORDS = new Set([
  "test",
  "testing",
  "tester",
  "tests",
  "fake",
  "fakes",
  "user",
  "users",
  "demo",
  "demos",
  "admin",
  "admins",
  "administrator",
  "superadmin",
  "sysadmin",
  "root",
  "moderator",
  "asdf",
  "asdfg",
  "asdfgh",
  "qwerty",
  "qwer",
  "qwert",
  "zxcv",
  "zxcvb",
  "abcd",
  "abcde",
  "abc",
  "xyz",
  "none",
  "null",
  "undefined",
  "unknown",
  "anon",
  "anonymous",
  "sample",
  "samples",
  "example",
  "examples",
  "temp",
  "temporary",
  "tempmail",
  "mailinator",
  "guerrillamail",
  "dummy",
  "mock",
  "sandbox",
  "placeholder",
  "student",
  "students",
  "name",
  "names",
  "noname",
  "unnamed",
  "fullname",
  "firstname",
  "lastname",
  "yourname",
  "myname",
  "realname",
  "fakename",
  "username",
  "nickname",
  "alias",
  "account",
  "profile",
  "member",
  "guest",
  "visitor",
  "client",
  "owner",
  "host",
  "bot",
  "robot",
  "chatgpt",
  "openai",
  "gemini",
  "claude",
  "opensource",
  "github",
  "vercel",
  "unishare",
  "notehub",
  "localhost",
  "foo",
  "bar",
  "baz",
  "qux",
  "lorem",
  "ipsum",
  "nobody",
  "someone",
  "anyone",
  "everyone",
  "somebody",
  "anybody",
  "human",
  "person",
  "people",
  "dude",
  "bro",
  "boss",
  "hacker",
  "troll",
  "spam",
  "lol",
  "lmao",
  "haha",
  "hehe",
  "hahaha",
  "hehehe",
  "first",
  "last",
  "random",
  "whatever",
  "anything",
  "something",
  "nothing",
  "fuck",
  "fucking",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "cock",
  "pussy",
  "porn",
  "xxx",
  "sexy",
  "nude",
]);

const BANNED_NAME_PHRASES = [
  "john doe",
  "jane doe",
  "john smith",
  "jane smith",
  "open source",
  "campus student",
  "test user",
  "demo user",
  "fake name",
  "real name",
  "full name",
  "first name",
  "last name",
  "your name",
  "my name",
  "first last",
  "student name",
  "foo bar",
  "lorem ipsum",
  "harry potter",
  "elon musk",
  "mr beast",
  "spider man",
  "iron man",
  "bat man",
  "super man",
  "cristiano ronaldo",
  "lionel messi",
  "shakib khan",
  "hero alam",
  "donald trump",
  "joe biden",
];

const FAKE_UNIVERSITY_WORDS = new Set([
  "test",
  "testing",
  "tester",
  "fake",
  "asdf",
  "qwer",
  "qwerty",
  "zxcv",
  "hjkl",
  "abcd",
  "abc",
  "xyz",
  "demo",
  "none",
  "null",
  "nil",
  "undefined",
  "sample",
  "example",
  "temp",
  "temporary",
  "unknown",
  "random",
  "nothing",
  "nobody",
  "someone",
  "anyone",
  "na",
  "opensource",
  "source",
  "github",
  "gitlab",
  "vercel",
  "netlify",
  "localhost",
  "local",
  "coding",
  "code",
  "dev",
  "developer",
  "software",
  "portal",
  "website",
  "web",
  "app",
  "unishare",
  "notehub",
  "project",
  "sandbox",
  "mock",
  "dummy",
  "trial",
  "placeholder",
  "anon",
  "anonymous",
  "admin",
  "user",
  "guest",
  "client",
  "server",
  "home",
  "house",
  "private",
  "personal",
  "custom",
  "other",
  "misc",
  "hacker",
  "gaming",
  "meme",
  "troll",
  "spam",
  "bot",
  "ai",
  "gpt",
  "chatgpt",
  "openai",
  "gemini",
  "claude",
  "hogwarts",
  "wakanda",
  "gotham",
  "marvel",
  "disney",
  "netflix",
  "google",
  "meta",
  "amazon",
  "microsoft",
  "apple",
  "tesla",
  "spacex",
  "nasa",
  "foobar",
  "foo",
  "bar",
  "baz",
  "lorem",
  "ipsum",
  "lol",
  "lmao",
  "haha",
  "hehe",
  "fuck",
  "shit",
  "bitch",
  "dick",
  "porn",
  "xxx",
]);

const BANNED_UNIVERSITY_PHRASES = [
  "open source",
  "foo bar",
  "lorem ipsum",
  "harry potter",
  "my university",
  "my college",
  "fake university",
  "test university",
  "custom university",
];

const INSTITUTION_KEYWORDS =
  /\b(university|univ|college|institute|institution|academy|school|medical|polytechnic|engineering|seminary|madrasah|madrasha|bishwabidyalay|biswabidyalay|vishwavidyalaya|mahavidyalaya|conservatory)\b/i;

const UNIVERSITY_CONNECTORS = new Set([
  "of",
  "and",
  "for",
  "the",
  "at",
  "in",
  "on",
  "to",
  "by",
  "al",
  "ul",
  "de",
  "la",
  "e",
]);

const KEYBOARD_MASH_RE =
  /(?:asdf|qwer|zxcv|hjkl|yuiop|fghj|vbnm|abcd|wxyz)/i;

const ALLOWED_CAMEL_PREFIX_RE = /^(?:Ma?c|De|La|Le|Di|Da|El|Al|Van|Von)\p{Lu}/u;

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

/** Detect joined CamelCase code/brand words such as OpenSource or TestUser. */
function hasCodingCamelCase(value: string): boolean {
  return value.split(/\s+/).some((rawToken) => {
    const token = rawToken.replace(/[^A-Za-z]/g, "");
    if (!token || ALLOWED_CAMEL_PREFIX_RE.test(token)) return false;
    return /\p{Ll}{2,}\p{Lu}/u.test(token);
  });
}

/** Split whitespace words plus camelCase sub-tokens in lowercase for blocklist matching. */
function extractLowerTokensWithCamel(words: string[]): string[] {
  const out: string[] = [];
  for (const w of words) {
    const clean = w.replace(/[^A-Za-z]/g, "");
    if (!clean) continue;
    out.push(clean.toLowerCase());
    const parts = clean
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    for (const p of parts) {
      if (p !== clean.toLowerCase()) out.push(p);
    }
  }
  return out;
}

/** Shared gibberish, keyboard-mash, and vowel check for name and institution tokens. */
const VALID_NAME_ABBREVIATIONS = new Set(["mst", "md", "sk", "dr", "st"]);

function isGibberishWord(
  word: string,
  options: { allowAcronym?: boolean } = {}
): boolean {
  const letters = word.replace(/[^A-Za-z]/g, "");
  const lower = letters.toLowerCase();

  if (options.allowAcronym === false && VALID_NAME_ABBREVIATIONS.has(lower)) {
    return false;
  }

  if (/(.)\1{2,}/iu.test(word)) return true;
  if (lower.length >= 5 && /^(.{1,2})\1{2,}$/.test(lower)) return true;
  if (lower.length >= 6 && new Set(lower).size < 3) return true;
  if (KEYBOARD_MASH_RE.test(lower)) return true;

  // Apply Latin vowel and consonant-cluster rules only to ASCII Latin words >= 3 chars
  const isPureAscii = !/[^\x00-\x7F]/.test(word);
  if (isPureAscii && letters.length >= 3) {
    const isAllCapsAcronym =
      options.allowAcronym && /^[A-Z]{2,5}$/.test(word.replace(/[.,()]/g, ""));
    if (!isAllCapsAcronym && !/[aeiouy]/i.test(letters)) return true;
    if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(letters)) return true;
  }
  return false;
}

export function findListedUniversityConflict(
  rawName: string
): BdUniversity | undefined {
  const norm = normalizeForMatch(rawName);
  const normNoParen = normalizeForMatch(rawName.replace(/\([^)]*\)/g, " "));
  if (!norm) return undefined;

  return BD_UNIVERSITIES.find((uni) => {
    const nameNorm = normalizeForMatch(uni.name);
    const nameNoParen = normalizeForMatch(uni.name.replace(/\([^)]*\)/g, " "));
    if (nameNorm === norm || nameNoParen === normNoParen) return true;
    if (normalizeForMatch(uni.shortName) === norm) return true;
    return (uni.aliases ?? []).some((alias) => {
      const aliasNorm = normalizeForMatch(alias);
      return aliasNorm === norm || aliasNorm === normNoParen;
    });
  });
}

export function validateFullName(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = normalizeText(raw);
  if (normalized.length < 5 || normalized.length > 70) {
    return {
      valid: false,
      normalized,
      error: "Enter your real full name (5–70 characters).",
    };
  }

  if (/\d/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Full name cannot contain numbers.",
    };
  }

  if (
    /[@/:\\]/.test(normalized) ||
    /[.'-]{2,}/.test(normalized) ||
    !/^[\p{L}.'\-\s]+$/u.test(normalized)
  ) {
    return {
      valid: false,
      normalized,
      error: "Use letters, spaces, dots, or hyphens only.",
    };
  }

  if (/(.)\1{2,}/iu.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Please enter a valid real name (no repeated character spam).",
    };
  }

  if (hasCodingCamelCase(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Please enter your real full name with standard spacing.",
    };
  }

  const lowerPhrase = normalized
    .toLowerCase()
    .replace(/[.'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (BANNED_NAME_PHRASES.some((p) => lowerPhrase.includes(p))) {
    return {
      valid: false,
      normalized,
      error: "Please enter your real name — placeholder or fictional names are not allowed.",
    };
  }

  const words = normalized
    .split(" ")
    .map((w) => w.replace(/^[.'-]+|[.'-]+$/g, ""))
    .filter(Boolean);

  if (words.length < 2 || words.length > 5) {
    return {
      valid: false,
      normalized,
      error: "Enter both your first and last name (e.g., Fahim Tajwar).",
    };
  }

  const meaningfulWords = words.filter((w) => w.length >= 2);
  const lastWord = words[words.length - 1];
  const totalLetters = words.join("").length;
  if (
    meaningfulWords.length < 2 ||
    lastWord.length < 2 ||
    !words.some((w) => w.length >= 3) ||
    totalLetters < 5
  ) {
    return {
      valid: false,
      normalized,
      error: "Enter your complete first and last name (no single-letter surnames).",
    };
  }

  if (new Set(words.map((w) => w.toLowerCase())).size < 2) {
    return {
      valid: false,
      normalized,
      error: "First name and last name cannot be identical.",
    };
  }

  const subTokens = extractLowerTokensWithCamel(words);
  if (subTokens.some((tok) => FAKE_NAME_WORDS.has(tok))) {
    return {
      valid: false,
      normalized,
      error: "Please enter your real name — placeholder/test words are not allowed.",
    };
  }

  if (words.some((w) => isGibberishWord(w, { allowAcronym: false }))) {
    return {
      valid: false,
      normalized,
      error: "Please enter a genuine first and last name.",
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
  if (normalized.length < 8 || normalized.length > 120) {
    return {
      valid: false,
      normalized,
      error: "Enter your full official university or college name (at least 8 characters).",
    };
  }

  if (/[@/:\\]/.test(normalized) || /(https?:\/\/|www\.)/i.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Enter the institution name only (not an email or URL).",
    };
  }

  if (/\d{4,}/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Please enter a genuine university or college name (no long number strings).",
    };
  }

  if (
    !/^[A-Za-z0-9][A-Za-z0-9\s.,'&()-]*[A-Za-z0-9)]$/.test(normalized) ||
    /[.,'&-]{2,}/.test(normalized)
  ) {
    return {
      valid: false,
      normalized,
      error: "Enter a valid institution name using standard letters and punctuation only.",
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

  if (hasCodingCamelCase(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Please enter an official university or college name (avoid joined brand/code words).",
    };
  }

  if (!INSTITUTION_KEYWORDS.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        "Include the full official type (e.g., University, College, Institute, or Academy).",
    };
  }

  const lowerPhrase = normalized
    .toLowerCase()
    .replace(/[^a-z\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (BANNED_UNIVERSITY_PHRASES.some((p) => lowerPhrase.includes(p))) {
    return {
      valid: false,
      normalized,
      error: "Please enter your real, officially recognized university or college name.",
    };
  }

  const words = normalized
    .split(" ")
    .map((w) => w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ""))
    .filter(Boolean);

  const subTokens = extractLowerTokensWithCamel(words);
  if (
    words.length < 2 ||
    subTokens.some((tok) => FAKE_UNIVERSITY_WORDS.has(tok))
  ) {
    return {
      valid: false,
      normalized,
      error: "Please enter your real, officially recognized university or college name.",
    };
  }

  const substantiveWords = words.filter(
    (w) =>
      w.length >= 3 &&
      !UNIVERSITY_CONNECTORS.has(w.toLowerCase()) &&
      !INSTITUTION_KEYWORDS.test(w)
  );
  if (substantiveWords.length === 0) {
    return {
      valid: false,
      normalized,
      error: "Enter the full institution name (e.g., Dhaka City College).",
    };
  }

  const nonConnectors = words
    .map((w) => w.toLowerCase())
    .filter((w) => !UNIVERSITY_CONNECTORS.has(w));
  if (new Set(nonConnectors).size !== nonConnectors.length) {
    return {
      valid: false,
      normalized,
      error: "Please enter an official institution name without duplicate words.",
    };
  }

  if (words.some((w) => isGibberishWord(w, { allowAcronym: true }))) {
    return {
      valid: false,
      normalized,
      error: "Enter a real institution name without random or repeated characters.",
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

  if (new Set(lower).size < 4 || /^(.{1,3})\1+$/.test(lower)) {
    return {
      valid: false,
      error:
        "Choose a stronger password without repeated characters or simple repeating patterns.",
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

  const deptWords = normalized
    .split(/[\s&.,'/-]+/)
    .filter(Boolean);
  const deptTokens = extractLowerTokensWithCamel(deptWords);
  if (
    deptTokens.some((tok) => FAKE_UNIVERSITY_WORDS.has(tok)) ||
    /(.)\1{3,}/i.test(normalized) ||
    KEYBOARD_MASH_RE.test(normalized)
  ) {
    return {
      valid: false,
      normalized,
      error: "Please enter your actual department name.",
    };
  }

  return { valid: true, normalized };
}

export function validateImageUpload(
  file: File | null | undefined,
  maxBytes = 4 * 1024 * 1024
): {
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

  if (file.size < 128) {
    return {
      valid: false,
      error: "Selected image looks empty or corrupted. Choose a real clear photo.",
    };
  }

  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return {
      valid: false,
      error: `Image must be ${mb} MB or smaller.`,
    };
  }

  return { valid: true };
}

