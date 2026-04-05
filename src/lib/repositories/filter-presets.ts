import { supabase } from "@/lib/supabase/client";
import type { FilterPreset } from "@/types";
import type { CreateFilterPresetInput } from "@/lib/schemas";

export async function getAllFilterPresets(): Promise<readonly FilterPreset[]> {
  const { data, error } = await supabase
    .from("filter_presets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch filter presets: ${error.message}`);
  return (data ?? []) as FilterPreset[];
}

export async function createFilterPreset(input: CreateFilterPresetInput): Promise<FilterPreset> {
  const { data, error } = await supabase.from("filter_presets").insert(input).select().single();

  if (error) throw new Error(`Failed to create filter preset: ${error.message}`);
  return data as FilterPreset;
}

export async function deleteFilterPreset(id: string): Promise<void> {
  const { data, error } = await supabase.from("filter_presets").delete().eq("id", id).select("id");

  if (error) throw new Error(`Failed to delete filter preset: ${error.message}`);
  if (!data || data.length === 0) throw new Error("Filter preset not found.");
}
