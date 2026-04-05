import { NextRequest } from "next/server";
import { successJson, errorJson } from "@/lib/api-utils";

// Track running ingestion to prevent concurrent runs
let isRunning = false;

export async function POST(request: NextRequest) {
  if (isRunning) {
    return errorJson("Ingestion is already running. Please wait.", 409);
  }

  const body = await request.json().catch(() => ({}));
  const sources = typeof body.sources === "string" ? body.sources : "all";

  isRunning = true;

  try {
    const stats = await runIngestion(sources);
    return successJson(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    return errorJson(message, 500);
  } finally {
    isRunning = false;
  }
}

export async function GET() {
  return successJson({ running: isRunning });
}

async function runIngestion(
  sources: string,
): Promise<{ fetched: number; deduplicated: number; stored: number }> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  const projectRoot = process.cwd();
  // Construct venv path at runtime to prevent Turbopack from resolving the symlink
  const venvPython = [projectRoot, "ingestion", ".venv", "bin", "python"].join("/");
  const cmd = `PYTHONPATH="${projectRoot}" "${venvPython}" -m ingestion.run --sources ${sources}`;

  const { stdout, stderr } = await execAsync(cmd, {
    cwd: projectRoot,
    timeout: 5 * 60 * 1000,
    maxBuffer: 10 * 1024 * 1024,
  });

  // Parse stats from log output (Python logging writes to stderr)
  const combined = stdout + stderr;
  const match = combined.match(/fetched=(\d+), deduplicated=(\d+), stored=(\d+)/);
  if (match) {
    return {
      fetched: parseInt(match[1], 10),
      deduplicated: parseInt(match[2], 10),
      stored: parseInt(match[3], 10),
    };
  }

  return { fetched: 0, deduplicated: 0, stored: 0 };
}
