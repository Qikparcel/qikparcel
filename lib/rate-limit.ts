import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Check if the user has exceeded the rate limit for creating records in a table.
 * Uses created_at to count how many records the user created in the last `windowMinutes`.
 * @returns { allowed: boolean, count: number } - allowed is false if count >= maxCount
 */
export async function checkCreateRateLimit(
  supabase: SupabaseClient,
  table: "trips" | "parcels",
  userIdColumn: "courier_id" | "sender_id",
  userId: string,
  windowMinutes: number = 15,
  maxCount: number = 3
): Promise<{ allowed: boolean; count: number }> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(userIdColumn, userId)
    .gte("created_at", since);

  if (error) {
    console.error(`[RATE-LIMIT] Error counting ${table}:`, error);
    return { allowed: true, count: 0 };
  }

  const countNum = count ?? 0;
  return {
    allowed: countNum < maxCount,
    count: countNum,
  };
}
