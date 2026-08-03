import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null | undefined;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (client !== undefined) {
    return client;
  }

  const config = getSupabaseConfig();
  if (!config) {
    client = null;
    return client;
  }

  client = createClient<Database>(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
  });

  return client;
}
