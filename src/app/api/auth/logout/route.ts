import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/app/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
}

