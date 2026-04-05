import { supabase } from "@/lib/supabase/client";
import type { SourceRating } from "@/types";

export async function rateSource(sourceId: string, starRating: number): Promise<SourceRating> {
  const { data, error } = await supabase
    .from("source_ratings")
    .upsert({ source_id: sourceId, star_rating: starRating }, { onConflict: "source_id" })
    .select()
    .single();

  if (error) throw new Error(`Failed to rate source: ${error.message}`);
  return data as SourceRating;
}

export async function getSourceRating(sourceId: string): Promise<SourceRating | null> {
  const { data, error } = await supabase
    .from("source_ratings")
    .select("*")
    .eq("source_id", sourceId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch source rating: ${error.message}`);
  }
  return data as SourceRating;
}

export async function getAllSourceRatings(): Promise<readonly SourceRating[]> {
  const { data, error } = await supabase
    .from("source_ratings")
    .select("*")
    .order("star_rating", { ascending: false });

  if (error) throw new Error(`Failed to fetch source ratings: ${error.message}`);
  return (data ?? []) as SourceRating[];
}
