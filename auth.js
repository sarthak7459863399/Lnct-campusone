/*
 * CampusOne demo authentication.
 *
 * FRONT-END ONLY. Accounts and passwords live in this file and sessions live in the
 * browser, so anyone can read them or fake a session. This is fine for a prototype
 * on GitHub Pages, NOT for real student data. Before real use, replace Auth.login()
 * with a call to a real backend (e.g. Firebase Auth, Supabase, or the college's SSO)
 * and enforce roles on the server.
 *
 * Each page declares who may see it with <html data-role="student|faculty|admin|guest">.
 * Load this script in <head> (not deferred) so redirects happen before the page shows.
 */
(function(){
  const USERS = [
    {role:"student", id:"0103CS241001", password:"student123", name:"Sarthak Gupta", first:"Sarthak", initials:"SG", meta:"B.Tech CSE · Semester 1 · Section A"},
    {role:"faculty", id:"FAC1024", password:"faculty123", name:"Prof. Neha Verma", first:"Prof. Verma", initials:"NV", meta:"Dept. of Mathematics · Assistant Professor"},
    {role:"admin", id:"admin", password:"admin123", name:"Campus Admin", first:"Admin", initials:"CA", meta:"Administration · Full access"}
  ];
  const ROLES = {
    student:{label:"Student", home:"index.html", idLabel:"Enrollment number", placeholder:"e.g. 0103CS241001"},
    faculty:{label:"Faculty", home:"faculty.html", idLabel:"Employee ID", placeholder:"e.g. FAC1024"},
    admin:{label:"Admin", home:"admin.html", idLabel:"Admin username", placeholder:"e.g. admin"}
  };
  const KEY = "campusone.session";
  const LOCK_KEY = "campusone.attempts";
  const SHORT = 8*60*60*1000, LONG = 7*24*60*60*1000;
  const MAX_ATTEMPTS = 5, LOCK_MS = 30*1000;

  const store = {
    get(k){ try{ return JSON.parse(sessionStorage.getItem(k) || localStorage.getItem(k)); }catch(e){ return null; } },
    set(k,v,persist){ try{ (persist?localStorage:sessionStorage).setItem(k,JSON.stringify(v)); }catch(e){} },
    del(k){ try{ sessionStorage.removeItem(k); localStorage.removeItem(k); }catch(e){} }
  };

  function session(){
    const s = store.get(KEY);
    if(!s || !ROLES[s.role] || Date.now() > s.expires){ if(s) store.del(KEY); return null; }
    return s;
  }

  function attempts(){ return store.get(LOCK_KEY) || {count:0, until:0}; }

  const Auth = {
    ROLES,
    demo: USERS.reduce((m,u)=>(m[u.role]={id:u.id,password:u.password},m),{}),
    session,
    homeFor(role){ return (ROLES[role]||ROLES.student).home; },
    lockedFor(){ return Math.max(0, attempts().until - Date.now()); },
    login(role, id, password, remember){
      const wait = Auth.lockedFor();
      if(wait) return {ok:false, error:`Too many attempts. Try again in ${Math.ceil(wait/1000)} seconds.`};
      const user = USERS.find(u => u.role===role && u.id.toLowerCase()===String(id).trim().toLowerCase() && u.password===password);
      if(!user){
        const a = attempts(); a.count++;
        if(a.count >= MAX_ATTEMPTS){ a.count = 0; a.until = Date.now()+LOCK_MS; }
        store.set(LOCK_KEY, a);
        return {ok:false, error: a.until > Date.now() ? "Too many attempts. Try again in 30 seconds." : `Incorrect ${ROLES[role].idLabel.toLowerCase()} or password.`};
      }
      store.del(LOCK_KEY);
      const {password:_, ...pub} = user;
      store.del(KEY);
      store.set(KEY, {...pub, expires: Date.now() + (remember?LONG:SHORT)}, remember);
      return {ok:true, user:pub};
    },
    logout(){ store.del(KEY); location.replace("login.html"); }
  };
  window.Auth = Auth;

  /* Route guard */
  const need = document.documentElement.dataset.role;
  const s = session();
  let target = null;
  if(need === "guest"){ if(s) target = Auth.homeFor(s.role); }
  else if(need){ if(!s) target = "login.html"; else if(s.role !== need) target = Auth.homeFor(s.role); }
  if(target){ document.documentElement.style.visibility = "hidden"; location.replace(target); }
})();
