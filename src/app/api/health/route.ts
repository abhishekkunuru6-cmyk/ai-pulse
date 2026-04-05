import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  // Check database connectivity
  try {
    const { error } = await supabase.from("sources").select("id", { count: "exact", head: true });
    checks.database = error ? "error" : "ok";
  } catch {
    checks.database = "error";
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 },
  );
}
