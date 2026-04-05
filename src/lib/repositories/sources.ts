import { supabase } from "@/lib/supabase/client";
import type { Source } from "@/types";
import type { CreateSourceInput, UpdateSourceInput, SourceFilterInput } from "@/lib/schemas";

export async function getAllSources(filters?: SourceFilterInput): Promise<readonly Source[]> {
  let query = supabase.from("sources").select("*").order("name");

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.platform) {
    query = query.eq("platform", filters.platform);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch sources: ${error.message}`);
  return data as Source[];
}

export async function getSourceById(id: string): Promise<Source | null> {
  const { data, error } = await supabase.from("sources").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch source: ${error.message}`);
  }
  return data as Source;
}

export async function createSource(input: CreateSourceInput): Promise<Source> {
  const { data, error } = await supabase
    .from("sources")
    .insert({ ...input, status: "active" as const })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("A source with this URL already exists.");
    }
    throw new Error(`Failed to create source: ${error.message}`);
  }
  return data as Source;
}

export async function updateSource(id: string, input: UpdateSourceInput): Promise<Source> {
  const { data, error } = await supabase
    .from("sources")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "PGRST116") throw new Error("Source not found.");
    throw new Error(`Failed to update source: ${error.message}`);
  }
  return data as Source;
}

export async function updateSourceStatus(
  id: string,
  status: "active" | "paused" | "deprecated",
): Promise<Source> {
  const { data, error } = await supabase
    .from("sources")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "PGRST116") throw new Error("Source not found.");
    throw new Error(`Failed to update source status: ${error.message}`);
  }
  return data as Source;
}

export async function getStaleSources(daysThreshold: number = 14): Promise<readonly Source[]> {
  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("status", "active")
    .or(`last_fetched.is.null,last_fetched.lt.${cutoff.toISOString()}`)
    .order("last_fetched", { ascending: true, nullsFirst: true });

  if (error) throw new Error(`Failed to fetch stale sources: ${error.message}`);
  return data as Source[];
}
