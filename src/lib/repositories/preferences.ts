import { supabase } from "@/lib/supabase/client";
import type { ArticlePreference, Rating } from "@/types";

export async function rateArticle(articleId: string, rating: Rating): Promise<ArticlePreference> {
  const { data, error } = await supabase
    .from("article_preferences")
    .upsert({ article_id: articleId, rating }, { onConflict: "article_id" })
    .select()
    .single();

  if (error) throw new Error(`Failed to rate article: ${error.message}`);
  return data as ArticlePreference;
}

export async function removeArticleRating(articleId: string): Promise<void> {
  const { error } = await supabase
    .from("article_preferences")
    .delete()
    .eq("article_id", articleId);

  if (error) throw new Error(`Failed to remove rating: ${error.message}`);
}

export async function getArticlePreference(articleId: string): Promise<ArticlePreference | null> {
  const { data, error } = await supabase
    .from("article_preferences")
    .select("*")
    .eq("article_id", articleId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch preference: ${error.message}`);
  }
  return data as ArticlePreference;
}

export async function getAllPreferences(): Promise<readonly ArticlePreference[]> {
  const { data, error } = await supabase
    .from("article_preferences")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch preferences: ${error.message}`);
  return (data ?? []) as ArticlePreference[];
}
