import { successJson, errorJson, parseBody, validateUuidParam } from "@/lib/api-utils";
import { sourceRatingSchema } from "@/lib/schemas";
import { rateSource, getSourceRating } from "@/lib/repositories";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validation = validateUuidParam(id);
  if (!validation.valid) return errorJson(validation.error, 400);

  try {
    const rating = await getSourceRating(id);
    return successJson(rating);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch rating";
    return errorJson(message, 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postValidation = validateUuidParam(id);
  if (!postValidation.valid) return errorJson(postValidation.error, 400);

  const parsed = await parseBody(request, sourceRatingSchema);
  if (!parsed.success) {
    return errorJson(parsed.error, 400);
  }

  try {
    const rating = await rateSource(id, parsed.data.star_rating);
    return successJson(rating);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to rate source";
    return errorJson(message, 500);
  }
}
