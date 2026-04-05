import { successJson, errorJson, parseBody } from "@/lib/api-utils";
import { createFilterPresetSchema } from "@/lib/schemas";
import { getAllFilterPresets, createFilterPreset } from "@/lib/repositories";

export async function GET() {
  try {
    const presets = await getAllFilterPresets();
    return successJson(presets);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch presets";
    return errorJson(message, 500);
  }
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, createFilterPresetSchema);
  if (!parsed.success) {
    return errorJson(parsed.error, 400);
  }

  try {
    const preset = await createFilterPreset(parsed.data);
    return successJson(preset, undefined, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create preset";
    return errorJson(message, 500);
  }
}
