import { NextRequest } from "next/server";
import { successJson, errorJson } from "@/lib/api-utils";

let isRunning = false;

const VALID_PERIODS = ["1month", "3months", "6months", "1year"] as const;
type BackfillPeriod = (typeof VALID_PERIODS)[number];

export async function POST(request: NextRequest) {
  if (isRunning) {
    return errorJson("Backfill is already running. Please wait.", 409);
  }

  const body = await request.json().catch(() => ({}));
  const period = VALID_PERIODS.includes(body.period) ? (body.period as BackfillPeriod) : "1month";

  isRunning = true;

  try {
    const stats = await runBackfill(period);
    return successJson(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backfill failed";
    return errorJson(message, 500);
  } finally {
    isRunning = false;
  }
}

export async function GET() {
  return successJson({ running: isRunning });
}

async function runBackfill(
  period: BackfillPeriod,
): Promise<{ fetched: number; deduplicated: number; stored: number }> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  const projectRoot = process.cwd();
  const venvPython = [projectRoot, "ingestion", ".venv", "bin", "python"].join("/");
  const cmd = `PYTHONPATH="${projectRoot}" "${venvPython}" -m ingestion.backfill --period ${period}`;

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: projectRoot,
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const combined = stdout + stderr;
    const match = combined.match(/fetched=(\d+), deduplicated=(\d+), stored=(\d+)/);
    if (match) {
      return {
        fetched: parseInt(match[1], 10),
        deduplicated: parseInt(match[2], 10),
        stored: parseInt(match[3], 10),
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backfill command failed";
    throw new Error(`Backfill failed for period ${period}: ${message}`);
  }

  return { fetched: 0, deduplicated: 0, stored: 0 };
}
