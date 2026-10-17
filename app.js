const toast = document.getElementById("toast");
let toastTimer;
function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2400)}
document.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",()=>showToast(button.dataset.tool+" is a demo feature.")));
document.querySelectorAll("[data-tab]").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll("[data-tab]").forEach(item=>item.classList.remove("active"));
  button.classList.add("active");
  const tab=button.dataset.tab;
  if(tab==="Home") window.scrollTo({top:0,behavior:"smooth"});
  else showToast(tab+" section is part of the prototype demo.");
}));
document.getElementById("profileBtn").addEventListener("click",()=>showToast("Student profile · Sarthak Gupta (demo)"));
document.getElementById("allNotices").addEventListener("click",()=>showToast("Showing the sample notices on this prototype."));
let deferredPrompt;
const installBtn=document.getElementById("installBtn");
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredPrompt=event;installBtn.hidden=false});
installBtn.addEventListener("click",async()=>{if(!deferredPrompt){showToast("Use your browser menu and choose Add to Home screen.");return;}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.hidden=true;});
if("serviceWorker" in navigator && (location.protocol==="https:" || location.hostname==="localhost")){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}