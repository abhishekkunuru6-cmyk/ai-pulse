import { successJson, errorJson, parseBody, validateUuidParam } from "@/lib/api-utils";
import { updateSourceSchema } from "@/lib/schemas";
import { updateSource } from "@/lib/repositories";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validation = validateUuidParam(id);
  if (!validation.valid) return errorJson(validation.error, 400);

  const parsed = await parseBody(request, updateSourceSchema);
  if (!parsed.success) {
    return errorJson(parsed.error, 400);
  }

  try {
    const source = await updateSource(id, parsed.data);
    return successJson(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update source";
    if (message.includes("not found")) {
      return errorJson(message, 404);
    }
    return errorJson(message, 500);
  }
}
