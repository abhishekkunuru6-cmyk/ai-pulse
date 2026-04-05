import { successJson, errorJson, parseBody, validateUuidParam } from "@/lib/api-utils";
import { updateSourceStatusSchema } from "@/lib/schemas";
import { updateSourceStatus } from "@/lib/repositories";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validation = validateUuidParam(id);
  if (!validation.valid) return errorJson(validation.error, 400);

  const parsed = await parseBody(request, updateSourceStatusSchema);
  if (!parsed.success) {
    return errorJson(parsed.error, 400);
  }

  try {
    const source = await updateSourceStatus(id, parsed.data.status);
    return successJson(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update status";
    if (message.includes("not found")) {
      return errorJson(message, 404);
    }
    return errorJson(message, 500);
  }
}
