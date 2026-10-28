import { NextRequest, NextResponse } from "next/server";
import { DELETE } from "../route";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/rides/[id]/cancel — Alternate convenience endpoint for cancellation
export async function POST(req: NextRequest, context: RouteContext) {
  return DELETE(req, context);
}
