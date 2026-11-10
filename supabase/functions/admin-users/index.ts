// Supabase Edge Function: admin-users
//
// Lets an approved CampusOne admin create, re-password and delete accounts from the
// admin console. It runs on Supabase's servers with the service-role key, which must
// never be shipped to the browser. Every request is checked: the caller's session must
// belong to a profile with role 'admin' and status 'active'.
//
// Request (POST, JSON), sent by admin.js via supabase.functions.invoke("admin-users"):
//   {action:"create", email, password, full_name, role, member_id?, department?, section?, program?, title?}
//   {action:"set_password", id, password}
//   {action:"delete", id}
// Response: {ok:true, ...} or {error:"message"} with a 4xx/5xx status.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ROLES = ["student", "faculty", "admin"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "The function is missing its service-role key. See supabase/SETUP.md." });
  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---- Who is calling? Must be an approved admin. ----
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Please sign in again." });
  const { data: caller, error: callerError } = await sb.auth.getUser(token);
  if (callerError || !caller?.user) return json(401, { error: "Your session has expired. Please sign in again." });
  const { data: me } = await sb.from("profiles").select("role,status").eq("id", caller.user.id).maybeSingle();
  if (!me || me.role !== "admin" || me.status !== "active") return json(403, { error: "Only admins can manage accounts." });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid request." }); }
  const log = (action: string) => sb.from("activity_log").insert({ actor_id: caller.user.id, action });

  // ---- Create an account (already confirmed and approved) ----
  if (body.action === "create") {
    const email = text(body.email, 254)?.toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const full_name = text(body.full_name);
    const role = String(body.role);
    if (!email || !EMAIL.test(email)) return json(400, { error: "Enter a valid email address." });
    if (password.length < 8) return json(400, { error: "The password must be at least 8 characters." });
    if (!full_name) return json(400, { error: "Enter a full name." });
    if (!ROLES.includes(role)) return json(400, { error: "Choose a valid role." });
    const section = role === "student" ? text(body.section, 20) : null;
    if (role === "student" && !section) return json(400, { error: "Students need a section (e.g. CSE-A)." });

    const { data: created, error } = await sb.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name },
    });
    if (error || !created?.user) {
      const msg = error?.message ?? "Couldn't create the account.";
      return json(400, { error: /already|registered|exists/i.test(msg) ? "An account with this email already exists." : msg });
    }

    // The database trigger made a pending 'student' profile; fill it in and approve it.
    const { error: profileError } = await sb.from("profiles").update({
      role, status: "active", full_name, email,
      member_id: text(body.member_id, 40),
      department: text(body.department, 80),
      section,
      program: role === "student" ? text(body.program, 80) : null,
      title: role === "faculty" ? text(body.title, 80) : null,
    }).eq("id", created.user.id);
    if (profileError) {
      await sb.auth.admin.deleteUser(created.user.id);   // don't leave a half-made account behind
      return json(400, { error: /duplicate key/i.test(profileError.message) ? "That enrollment / employee ID is already in use." : profileError.message });
    }
    await log(`created ${full_name} (${role})`);
    return json(200, { ok: true, id: created.user.id });
  }

  // ---- Set a new password for someone ----
  if (body.action === "set_password") {
    const id = text(body.id, 64);
    const password = typeof body.password === "string" ? body.password : "";
    if (!id) return json(400, { error: "Missing user." });
    if (password.length < 8) return json(400, { error: "The password must be at least 8 characters." });
    const { error } = await sb.auth.admin.updateUserById(id, { password });
    if (error) return json(400, { error: error.message });
    const { data: p } = await sb.from("profiles").select("full_name").eq("id", id).maybeSingle();
    await log(`set a new password for ${p?.full_name ?? "a user"}`);
    return json(200, { ok: true });
  }

  // ---- Delete an account (profile and records go with it) ----
  if (body.action === "delete") {
    const id = text(body.id, 64);
    if (!id) return json(400, { error: "Missing user." });
    if (id === caller.user.id) return json(400, { error: "You can't delete your own account." });
    const { data: p } = await sb.from("profiles").select("full_name,role").eq("id", id).maybeSingle();
    const { error } = await sb.auth.admin.deleteUser(id);
    if (error) return json(400, { error: error.message });
    await log(`deleted ${p?.full_name ?? "a user"}${p ? ` (${p.role})` : ""}`);
    return json(200, { ok: true });
  }

  return json(400, { error: "Unknown action." });
});
