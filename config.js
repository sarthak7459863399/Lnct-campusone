/*
 * Supabase connection settings.
 * Find both values in Supabase: Project Settings -> API (or "Connect" at the top of the dashboard).
 *
 *  - supabaseUrl:     the Project URL, e.g. https://abcdefghijkl.supabase.co
 *  - supabaseAnonKey: the "anon public" key (or the newer "publishable" key, sb_publishable_...)
 *
 * Both are meant to be public and are safe to commit; your data is protected by the
 * row-level security rules in supabase/schema.sql.
 * NEVER put the "service_role" or "secret" key here.
 */
window.CAMPUSONE_CONFIG = {
  supabaseUrl: "https://cdbilhwxbvngzsretykp.supabase.co",
  supabaseAnonKey: "sb_publishable_7FZZUCjaOHSM7ZVKj-G_fA_lAV6St8t"
};
