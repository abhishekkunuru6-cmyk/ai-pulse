/**
 * Lightweight Gemini API client using the REST endpoint directly.
 * No SDK dependency — just fetch calls with model fallback and retry.
 */

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Ordered by preference: try newest first, fall back to older free-tier models
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
] as const;

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 5_000;

interface GeminiResponse {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly { readonly text?: string }[];
    };
  }[];
  readonly error?: { readonly message?: string; readonly code?: number };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryDelay(body: string): number | null {
  const match = body.match(/retryDelay.*?(\d+(?:\.\d+)?)s/i);
  return match ? Math.ceil(parseFloat(match[1]) * 1000) : null;
}

async function callGemini(
  model: string,
  prompt: string,
  apiKey: string,
): Promise<
  { ok: true; text: string } | { ok: false; status: number; body: string; retryable: boolean }
> {
  const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.9,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const retryable = response.status === 429 || response.status === 503;
    return { ok: false, status: response.status, body, retryable };
  }

  const data: GeminiResponse = await response.json();

  if (data.error?.message) {
    return {
      ok: false,
      status: data.error.code ?? 400,
      body: data.error.message,
      retryable: false,
    };
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return { ok: false, status: 500, body: "Empty response from Gemini", retryable: false };
  }

  return { ok: true, text };
}

async function callWithRetry(
  model: string,
  prompt: string,
  apiKey: string,
): Promise<
  { ok: true; text: string } | { ok: false; status: number; body: string; skip: boolean }
> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await callGemini(model, prompt, apiKey);

    if (result.ok) return result;

    // Not retryable — stop immediately
    if (!result.retryable) {
      const skip = result.status === 404 || result.body.includes("not found");
      return { ok: false, status: result.status, body: result.body, skip };
    }

    // On 429, check if it's a daily quota (limit: 0) — no point retrying
    if (result.body.includes("limit: 0")) {
      return { ok: false, status: result.status, body: result.body, skip: true };
    }

    // Retryable rate limit — wait and try again
    if (attempt < MAX_RETRIES) {
      const apiDelay = parseRetryDelay(result.body);
      const delay = apiDelay ?? RETRY_BASE_DELAY_MS * (attempt + 1);
      await sleep(Math.min(delay, 40_000)); // Cap at 40s
    }
  }

  return { ok: false, status: 429, body: "Rate limit exceeded after retries", skip: true };
}

export async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not configured");
  }

  const errors: string[] = [];

  for (const model of MODELS) {
    const result = await callWithRetry(model, prompt, apiKey);

    if (result.ok) {
      return result.text;
    }

    errors.push(`${model}: ${result.status}`);

    // Skip to next model if this one is unavailable or quota-exhausted
    if (result.skip) continue;

    // For unexpected errors, throw immediately
    throw new Error(`Gemini API error (${model}, ${result.status}): ${result.body}`);
  }

  throw new Error(`All Gemini models exhausted. Tried: ${errors.join(", ")}. Try again later.`);
}
