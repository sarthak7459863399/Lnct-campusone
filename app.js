/* Shared UI for every signed-in page: helpers, user details, greeting, account menu, nav, toast, PWA. */
const $ = id => document.getElementById(id);
const toast = $("toast");
let toastTimer;
function showToast(message){
  if(!toast) return;
  toast.textContent = message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>toast.classList.remove("show"), 2800);
}
window.showToast = showToast;

/* ---- Helpers shared by the dashboards ---- */
const TONES = ["blue","teal","pink","green","amber"];
window.UI = {
  esc: s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),
  tone(key){ let h = 0; for(const ch of String(key)) h = (h*31 + ch.charCodeAt(0)) >>> 0; return TONES[h % TONES.length]; },
  time: t => String(t).slice(0,5),
  initials: n => String(n||"?").replace(/^(Prof\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s*/i,"").split(/\s+/).filter(Boolean).map(p=>p[0]).join("").slice(0,2).toUpperCase() || "?",
  // "Prof. Neha Verma" -> "Prof. Verma", "Sarthak Gupta" -> "Sarthak"
  firstName(p){
    const parts = String(p.full_name || "").trim().split(/\s+/);
    if(/^(Prof\.?|Dr\.?)$/i.test(parts[0]) && parts.length > 1) return `${parts[0]} ${parts[parts.length-1]}`;
    return parts[0] || "";
  },
  today: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; },
  ago(ts){
    const s = (Date.now() - new Date(ts)) / 1000;
    if(s < 60) return "Just now";
    if(s < 3600) return `${Math.floor(s/60)}m ago`;
    if(s < 86400) return `${Math.floor(s/3600)}h ago`;
    if(s < 172800) return "Yesterday";
    if(s < 604800) return `${Math.floor(s/86400)} days ago`;
    return new Date(ts).toLocaleDateString("en-IN",{day:"numeric",month:"short"});
  },
  due(ts){
    const days = Math.ceil((new Date(ts) - Date.now()) / 86400000);
    if(new Date(ts) < Date.now()) return "Overdue";
    return days <= 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`;
  },
  // Show a friendly message for a Supabase error and keep the raw one in the console.
  fail(context, error){ console.error(context, error); showToast(`${context}: ${error?.message || "something went wrong"}`); },
  empty: (msg, icon="calendar") => `<p class="empty"><svg class="i"><use href="#i-${icon}"/></svg>${msg}</p>`
};

/* ---- Greeting & date ---- */
(function greet(){
  const d = new Date(), h = d.getHours();
  if($("greeting")) $("greeting").textContent = h<12 ? "Good morning" : h<17 ? "Good afternoon" : "Good evening";
  if($("today")) $("today").textContent = d.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});
  if($("dayPill")) $("dayPill").textContent = d.toLocaleDateString("en-IN",{weekday:"long"});
})();

/* ---- Signed-in user ---- */
window.Auth?.ready.then(({profile, error}) => {
  if(error){ showToast("Couldn't reach the server. Some data may be missing."); return; }
  if(!profile) return;
  const meta = profile.role === "student" ? [profile.program, profile.section].filter(Boolean).join(" · ")
             : profile.role === "faculty" ? [profile.department && `Dept. of ${profile.department}`, profile.title].filter(Boolean).join(" · ")
             : [profile.department, "Full access"].filter(Boolean).join(" · ");
  const values = {
    name: profile.full_name, first: UI.firstName(profile), initials: UI.initials(profile.full_name),
    meta, role: Auth.ROLES[profile.role].label, id: profile.member_id || ""
  };
  document.querySelectorAll("[data-user]").forEach(el => { el.textContent = values[el.dataset.user] ?? ""; });
});

/* ---- Account menu ---- */
const profileBtn = $("profileBtn"), profileMenu = $("profileMenu");
function setMenu(open){
  if(!profileMenu) return;
  profileMenu.hidden = !open;
  profileBtn.setAttribute("aria-expanded", String(open));
  if(open) profileMenu.querySelector("[role=menuitem]")?.focus();
}
profileBtn?.addEventListener("click", e => { e.stopPropagation(); setMenu(profileMenu.hidden); });
document.addEventListener("click", e => { if(profileMenu && !profileMenu.hidden && !profileMenu.contains(e.target)) setMenu(false); });
document.addEventListener("keydown", e => { if(e.key==="Escape" && profileMenu && !profileMenu.hidden){ setMenu(false); profileBtn.focus(); } });
document.querySelectorAll("[data-action=logout]").forEach(b => b.addEventListener("click", () => { b.disabled = true; Auth.signOut(); }));
document.querySelectorAll("[data-action=profile]").forEach(b => b.addEventListener("click", () => {
  setMenu(false);
  Auth.ready.then(({profile}) => profile && showToast(`${profile.full_name}${profile.member_id ? " · " + profile.member_id : ""}`));
}));

/* ---- Navigation & placeholder tools ---- */
document.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => showToast(button.dataset.tool + " is coming soon.")));
document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", e => {
  const tab = button.dataset.tab;
  if(tab === "Profile"){ e.stopPropagation(); window.scrollTo({top:0,behavior:"smooth"}); setMenu(true); return; }
  document.querySelectorAll("[data-tab]").forEach(item => { item.classList.remove("active"); item.removeAttribute("aria-current"); });
  button.classList.add("active"); button.setAttribute("aria-current","page");
  const target = button.dataset.target && $(button.dataset.target);
  if(target) target.scrollIntoView({behavior:"smooth", block:"start"});
  else window.scrollTo({top:0,behavior:"smooth"});
}));
$("bellBtn")?.addEventListener("click", () => { const n = $("noticesPanel"); if(n) n.scrollIntoView({behavior:"smooth", block:"start"}); });

/* ---- PWA install ---- */
let deferredPrompt;
const installBtn = $("installBtn");
if(installBtn){
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault(); deferredPrompt = event;
    installBtn.hidden = false; installBtn.closest("[hidden]")?.removeAttribute("hidden");
  });
  installBtn.addEventListener("click", async () => {
    if(!deferredPrompt){ showToast("Use your browser menu and choose Add to Home screen."); return; }
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null;
    installBtn.hidden = true; installBtn.closest(".panel")?.setAttribute("hidden", "");
  });
}
if("serviceWorker" in navigator && (location.protocol==="https:" || location.hostname==="localhost")){
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
