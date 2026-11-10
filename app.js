const $ = id => document.getElementById(id);
const toast = $("toast");
let toastTimer;
function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2400)}

/* ---- Demo timetable (sample data) ---- */
const SCHEDULE = [
  {start:"09:00",end:"10:00",title:"Engineering Mathematics",place:"Room 204 · Block A",code:"MA",tone:"blue"},
  {start:"10:00",end:"11:00",title:"Basic Electrical Engineering",place:"Room 108 · Block B",code:"EE",tone:"teal"},
  {start:"11:00",end:"12:00",title:"Free period",place:"Use this time to revise or relax",code:"FREE",tone:"amber",free:true},
  {start:"12:00",end:"13:00",title:"Engineering Chemistry",place:"Lab 2 · Block C",code:"CH",tone:"pink"},
  {start:"14:00",end:"16:00",title:"Engineering Graphics",place:"Drawing Hall · Block D",code:"EG",tone:"green"}
];
const mins = t => {const [h,m]=t.split(":").map(Number);return h*60+m};
const fmtDur = m => m>=60 ? `${Math.floor(m/60)}h ${m%60 ? m%60+"m" : ""}`.trim() : `${m} min`;

function render(){
  const d = new Date();
  const now = d.getHours()*60 + d.getMinutes();
  const h = d.getHours();
  $("greeting").textContent = h<12 ? "Good morning" : h<17 ? "Good afternoon" : "Good evening";
  $("today").textContent = d.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});
  $("dayPill").textContent = d.toLocaleDateString("en-IN",{weekday:"long"}) + " · Demo";

  const state = s => mins(s.end)<=now ? "past" : mins(s.start)<=now ? "now" : "upcoming";

  $("schedule").innerHTML = SCHEDULE.map(s => {
    const st = state(s);
    return `<li class="class-row tone-${s.tone} ${st}"${st==="now"?' aria-current="time"':""}>
      <span class="time">${s.start}<small>${s.end}</small></span>
      <div class="class-info"><strong>${s.title}${st==="now"?'<span class="badge-now">NOW</span>':""}</strong><small>${s.place}</small></div>
      <span class="subject-code">${s.code}</span></li>`;
  }).join("");

  const classes = SCHEDULE.filter(s=>!s.free);
  $("classCount").textContent = classes.length;
  $("classSegments").innerHTML = classes.map(s=>`<i class="${state(s)==="past"?"done":state(s)==="now"?"now":""}"></i>`).join("");
  const done = classes.filter(s=>state(s)==="past").length;
  const upcoming = classes.find(s=>state(s)!=="past");
  $("classSummary").textContent = upcoming ? `${done} done · Next: ${upcoming.title.replace("Engineering ","Engg. ")}` : "All classes done today";

  const card = $("nextCard");
  const current = SCHEDULE.find(s=>state(s)==="now");
  const next = SCHEDULE.find(s=>state(s)==="upcoming" && !s.free);
  const show = current || next || SCHEDULE[0];
  card.classList.toggle("live", !!current);
  $("nextTitle").textContent = show.title;
  $("nextRoom").textContent = show.place;
  $("nextTime").textContent = `${show.start} – ${show.end}`;
  if(current){
    const total = mins(current.end)-mins(current.start), gone = now-mins(current.start);
    $("nextLabel").textContent = "In progress";
    $("nextProgress").style.width = Math.round(gone/total*100)+"%";
    $("nextHint").textContent = `Ends in ${fmtDur(total-gone)}`;
  } else if(next){
    $("nextLabel").textContent = "Up next";
    $("nextProgress").style.width = "0%";
    $("nextHint").textContent = `Starts in ${fmtDur(mins(next.start)-now)}`;
  } else {
    $("nextLabel").textContent = "Tomorrow";
    $("nextProgress").style.width = "100%";
    $("nextHint").textContent = "You're done for today. First class tomorrow at " + SCHEDULE[0].start;
  }
}
render();
setInterval(render, 60000);

/* ---- Interactions ---- */
document.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",()=>showToast(button.dataset.tool+" is a demo feature.")));
document.querySelectorAll("[data-tab]").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll("[data-tab]").forEach(item=>{item.classList.remove("active");item.removeAttribute("aria-current")});
  button.classList.add("active");
  button.setAttribute("aria-current","page");
  const tab=button.dataset.tab;
  if(tab==="Home") window.scrollTo({top:0,behavior:"smooth"});
  else showToast(tab+" section is part of the prototype demo.");
}));
$("profileBtn").addEventListener("click",()=>showToast("Student profile · Sarthak Gupta (demo)"));
$("bellBtn").addEventListener("click",()=>showToast("You have 3 new campus notices."));
$("allNotices").addEventListener("click",()=>showToast("Showing the sample notices on this prototype."));

/* ---- PWA install ---- */
let deferredPrompt;
const installBtn=$("installBtn");
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredPrompt=event;installBtn.hidden=false});
installBtn.addEventListener("click",async()=>{if(!deferredPrompt){showToast("Use your browser menu and choose Add to Home screen.");return;}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.hidden=true;});
if("serviceWorker" in navigator && (location.protocol==="https:" || location.hostname==="localhost")){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
