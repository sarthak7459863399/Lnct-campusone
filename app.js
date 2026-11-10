/* Shared UI for every signed-in page: user details, greeting, account menu, nav, toast, PWA. */
const $ = id => document.getElementById(id);
const toast = $("toast");
let toastTimer;
function showToast(message){
  if(!toast) return;
  toast.textContent = message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>toast.classList.remove("show"), 2400);
}
window.showToast = showToast;

/* ---- Signed-in user ---- */
const user = window.Auth && Auth.session();
if(user){
  const values = {name:user.name, first:user.first, initials:user.initials, meta:user.meta, role:Auth.ROLES[user.role].label, id:user.id};
  document.querySelectorAll("[data-user]").forEach(el => { el.textContent = values[el.dataset.user] ?? ""; });
}

/* ---- Greeting & date ---- */
(function greet(){
  const d = new Date(), h = d.getHours();
  if($("greeting")) $("greeting").textContent = h<12 ? "Good morning" : h<17 ? "Good afternoon" : "Good evening";
  if($("today")) $("today").textContent = d.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});
  if($("dayPill")) $("dayPill").textContent = d.toLocaleDateString("en-IN",{weekday:"long"}) + " · Demo";
})();

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
document.querySelectorAll("[data-action=logout]").forEach(b => b.addEventListener("click", () => Auth.logout()));
document.querySelectorAll("[data-action=profile]").forEach(b => b.addEventListener("click", () => { setMenu(false); showToast(`${user?.name} · ${user?.id} (demo profile)`); }));

/* ---- Demo interactions ---- */
document.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => showToast(button.dataset.tool + " is a demo feature.")));
document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", e => {
  const tab = button.dataset.tab;
  if(tab === "Profile"){ e.stopPropagation(); window.scrollTo({top:0,behavior:"smooth"}); setMenu(true); return; }
  document.querySelectorAll("[data-tab]").forEach(item => { item.classList.remove("active"); item.removeAttribute("aria-current"); });
  button.classList.add("active"); button.setAttribute("aria-current","page");
  if(button.dataset.home !== undefined) window.scrollTo({top:0,behavior:"smooth"});
  else showToast(tab + " section is part of the prototype demo.");
}));
$("bellBtn")?.addEventListener("click", () => showToast("You have 3 new campus notices."));
$("allNotices")?.addEventListener("click", () => showToast("Showing the sample notices on this prototype."));

/* ---- PWA install ---- */
let deferredPrompt;
const installBtn = $("installBtn");
if(installBtn){
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferredPrompt = event; installBtn.hidden = false; });
  installBtn.addEventListener("click", async () => {
    if(!deferredPrompt){ showToast("Use your browser menu and choose Add to Home screen."); return; }
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.hidden = true;
  });
}
if("serviceWorker" in navigator && (location.protocol==="https:" || location.hostname==="localhost")){
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
