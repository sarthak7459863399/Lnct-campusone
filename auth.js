/*
 * CampusOne authentication (Supabase).
 *
 * Load order in <head>: supabase-js (CDN) -> config.js -> auth.js (not deferred).
 * Each page declares who may open it with <html data-role="student|faculty|admin|guest|recovery">.
 * The page stays hidden until the check passes; otherwise the visitor is redirected.
 *
 * Roles live in the `profiles` table and are enforced by the database's row-level
 * security, so editing this file in the browser cannot grant access to anyone's data.
 *
 * Exposes window.Auth:
 *   Auth.client         Supabase client (null if not configured)
 *   Auth.ready          Promise -> {user, profile} on protected pages
 *   Auth.signIn(...)    Auth.signOut(msg)    Auth.resetPassword(email)
 */
(function(){
  const cfg = window.CAMPUSONE_CONFIG || {};
  const libLoaded = !!(window.supabase && window.supabase.createClient);
  const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && libLoaded);

  const ROLES = {
    student: {label:"Student", home:"index.html"},
    faculty: {label:"Faculty", home:"faculty.html"},
    admin:   {label:"Admin",   home:"admin.html"}
  };
  const REMEMBER = "campusone.remember";
  const FLASH = "campusone.flash";
  const safe = fn => { try { return fn(); } catch(e) { return null; } };

  // "Keep me signed in" off -> keep the session only for this browser tab.
  const storage = {
    getItem: k => safe(() => sessionStorage.getItem(k) ?? localStorage.getItem(k)),
    setItem: (k, v) => safe(() => {
      const persist = localStorage.getItem(REMEMBER) !== "0";
      (persist ? localStorage : sessionStorage).setItem(k, v);
      (persist ? sessionStorage : localStorage).removeItem(k);
    }),
    removeItem: k => safe(() => { sessionStorage.removeItem(k); localStorage.removeItem(k); })
  };

  const client = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
  }) : null;

  async function loadProfile(userId){
    const {data, error} = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
    if(error) throw error;
    return data;
  }

  const Auth = {
    ROLES, client, configured, libLoaded,
    homeFor: role => (ROLES[role] || ROLES.student).home,
    flash: msg => safe(() => sessionStorage.setItem(FLASH, msg)),
    takeFlash: () => safe(() => { const m = sessionStorage.getItem(FLASH); sessionStorage.removeItem(FLASH); return m; }),

    async signIn(role, email, password, remember){
      safe(() => localStorage.setItem(REMEMBER, remember ? "1" : "0"));
      const {data, error} = await client.auth.signInWithPassword({email: email.trim(), password});
      if(error){
        const msg = /invalid login credentials/i.test(error.message) ? "Incorrect email or password."
                  : /email not confirmed/i.test(error.message) ? "This email hasn't been confirmed yet. Ask an admin to confirm your account."
                  : error.message;
        return {ok:false, error:msg};
      }
      let profile = null;
      try { profile = await loadProfile(data.user.id); } catch(e) { /* handled below */ }
      if(!profile){ await client.auth.signOut(); return {ok:false, error:"Your account has no CampusOne profile yet. Ask an admin to set it up."}; }
      if(profile.status !== "active"){ await client.auth.signOut(); return {ok:false, error:"Your account is waiting for admin approval."}; }
      if(profile.role !== role){
        await client.auth.signOut();
        const real = ROLES[profile.role].label;
        return {ok:false, error:`This is a ${real.toLowerCase()} account. Choose "${real}" above and try again.`};
      }
      return {ok:true, profile};
    },

    async signOut(msg){
      if(msg) Auth.flash(msg);
      try { await client?.auth.signOut(); } catch(e) {}
      storage.removeItem(REMEMBER);
      location.replace("login.html");
    },

    resetPassword: email => client.auth.resetPasswordForEmail(email.trim(), {redirectTo: new URL("reset.html", location.href).href})
  };
  window.Auth = Auth;

  /* ---------- Route guard ---------- */
  const need = document.documentElement.dataset.role;
  const root = document.documentElement;
  root.classList.add("auth-pending");
  const reveal = () => root.classList.remove("auth-pending");
  const never = new Promise(() => {});
  const go = url => { location.replace(url); return never; };

  Auth.ready = (async () => {
    if(need === "recovery" || (need === "guest" && !configured)){ reveal(); return {}; }
    if(!configured) return go("login.html");

    const {data:{session}} = await client.auth.getSession();
    if(!session){ if(need === "guest"){ reveal(); return {}; } return go("login.html"); }

    let profile;
    try { profile = await loadProfile(session.user.id); }
    catch(error){
      // Couldn't reach Supabase: don't sign the user out, just show the page with an error.
      if(need === "guest"){ reveal(); return {}; }
      reveal(); return {user:session.user, profile:null, error};
    }
    if(!profile || profile.status !== "active"){
      await client.auth.signOut();
      if(need !== "guest") Auth.flash(profile ? "Your account is waiting for admin approval." : "Your account has no CampusOne profile yet.");
      if(need === "guest"){ reveal(); return {}; }
      return go("login.html");
    }
    if(need === "guest" || profile.role !== need) return go(Auth.homeFor(profile.role));

    // Signed out elsewhere (another tab, or the session expired) -> back to login.
    client.auth.onAuthStateChange(event => { if(event === "SIGNED_OUT") location.replace("login.html"); });
    reveal();
    return {user:session.user, profile};
  })();
})();
