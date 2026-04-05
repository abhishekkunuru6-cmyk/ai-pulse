import { successJson, errorJson, validateUuidParam } from "@/lib/api-utils";
import { deleteFilterPreset } from "@/lib/repositories";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validation = validateUuidParam(id);
  if (!validation.valid) return errorJson(validation.error, 400);

  try {
    await deleteFilterPreset(id);
    return successJson({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete preset";
    if (message.includes("not found")) {
      return errorJson(message, 404);
    }
    return errorJson(message, 500);
  }
}
