import { supabase } from "@/lib/supabase/client";

export interface DashboardStats {
  readonly total_articles: number;
  readonly total_sources: number;
  readonly articles_today: number;
  readonly unread_count: number;
  readonly saved_count: number;
  readonly sources_by_status: Record<string, number>;
  readonly sources_by_category: Record<string, number>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const results = await Promise.all([
    supabase.from("articles").select("*", { count: "exact", head: true }),
    supabase.from("sources").select("*", { count: "exact", head: true }),
    supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("is_read", false),
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("is_saved", true),
    supabase.from("sources").select("status, category"),
  ]);

  for (const result of results) {
    if ("error" in result && result.error) {
      throw new Error(`Stats query failed: ${result.error.message}`);
    }
  }

  const [
    { count: totalArticles },
    { count: totalSources },
    { count: articlesToday },
    { count: unreadCount },
    { count: savedCount },
    { data: sourcesData },
  ] = results;

  const sourcesList = sourcesData ?? [];
  const sources_by_status: Record<string, number> = {};
  const sources_by_category: Record<string, number> = {};

  for (const s of sourcesList) {
    sources_by_status[s.status] = (sources_by_status[s.status] ?? 0) + 1;
    sources_by_category[s.category] = (sources_by_category[s.category] ?? 0) + 1;
  }

  return {
    total_articles: totalArticles ?? 0,
    total_sources: totalSources ?? 0,
    articles_today: articlesToday ?? 0,
    unread_count: unreadCount ?? 0,
    saved_count: savedCount ?? 0,
    sources_by_status,
    sources_by_category,
  };
}
