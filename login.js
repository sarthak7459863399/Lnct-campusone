const $ = id => document.getElementById(id);
const form = $("loginForm"), userId = $("userId"), password = $("password"), errorBox = $("formError"), submitBtn = $("submitBtn");
const roleInputs = [...document.querySelectorAll("input[name=role]")];
const role = () => roleInputs.find(r => r.checked).value;

function showToast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(showToast.t); showToast.t=setTimeout(()=>t.classList.remove("show"),2600); }
function showError(msg){ errorBox.querySelector("span").textContent = msg; errorBox.hidden = !msg; }

function applyRole(){
  const r = Auth.ROLES[role()], demo = Auth.demo[role()];
  $("idLabel").textContent = r.idLabel;
  userId.placeholder = r.placeholder;
  $("demoRole").textContent = r.label.toLowerCase();
  $("demoId").textContent = demo.id;
  $("demoPw").textContent = demo.password;
  showError("");
  userId.removeAttribute("aria-invalid"); password.removeAttribute("aria-invalid");
}
roleInputs.forEach(r => r.addEventListener("change", () => { applyRole(); userId.focus(); }));
applyRole();

$("togglePw").addEventListener("click", e => {
  const show = password.type === "password";
  password.type = show ? "text" : "password";
  e.currentTarget.setAttribute("aria-pressed", String(show));
  e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
  e.currentTarget.querySelector("use").setAttribute("href", show ? "#i-eye-off" : "#i-eye");
});

$("useDemo").addEventListener("click", () => {
  const d = Auth.demo[role()];
  userId.value = d.id; password.value = d.password; showError(""); submitBtn.focus();
});
$("forgot").addEventListener("click", () => showToast("Password reset is handled by the college office in this demo."));

form.addEventListener("submit", e => {
  e.preventDefault();
  userId.toggleAttribute("aria-invalid", !userId.value.trim());
  password.toggleAttribute("aria-invalid", !password.value);
  if(!userId.value.trim() || !password.value){
    showError(`Enter your ${Auth.ROLES[role()].idLabel.toLowerCase()} and password.`);
    (userId.value.trim() ? password : userId).focus();
    return;
  }
  submitBtn.disabled = true; submitBtn.classList.add("loading"); showError("");
  setTimeout(() => {   // short delay so the sign-in feels like a real request
    const res = Auth.login(role(), userId.value, password.value, $("remember").checked);
    if(res.ok){ location.replace(Auth.homeFor(res.user.role)); return; }
    submitBtn.disabled = false; submitBtn.classList.remove("loading");
    showError(res.error);
    password.value = ""; password.setAttribute("aria-invalid",""); password.focus();
  }, 550);
});
