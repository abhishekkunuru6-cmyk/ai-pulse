import { NextRequest } from "next/server";
import { successJson, errorJson, parseSearchParams, parseBody } from "@/lib/api-utils";
import { sourceFilterSchema, createSourceSchema } from "@/lib/schemas";
import { getAllSources, createSource } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request.nextUrl.searchParams, sourceFilterSchema);
  if (!parsed.success) {
    return errorJson(parsed.error, 400);
  }

  try {
    const sources = await getAllSources(parsed.data);
    return successJson(sources);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch sources";
    return errorJson(message, 500);
  }
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, createSourceSchema);
  if (!parsed.success) {
    return errorJson(parsed.error, 400);
  }

  try {
    const source = await createSource(parsed.data);
    return successJson(source, undefined, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create source";
    if (message.includes("already exists")) {
      return errorJson(message, 409);
    }
    return errorJson(message, 500);
  }
}
