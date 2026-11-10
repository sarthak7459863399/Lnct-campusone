const $ = id => document.getElementById(id);
const form = $("loginForm"), email = $("userId"), password = $("password"), submitBtn = $("submitBtn");
const roleInputs = [...document.querySelectorAll("input[name=role]")];
const role = () => roleInputs.find(r => r.checked).value;

function showToast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(showToast.t); showToast.t=setTimeout(()=>t.classList.remove("show"),3200); }
function showBox(id, msg){ const el=$(id); el.querySelector("span").textContent = msg || ""; el.hidden = !msg; }
const showError = msg => { showBox("formError", msg); if(msg) showBox("formNote", ""); };
const showNote  = msg => { showBox("formNote", msg);  if(msg) showBox("formError", ""); };
function busy(on){ submitBtn.disabled = on; submitBtn.classList.toggle("loading", on); }

// Remember the last role picked on this device.
try { const r = localStorage.getItem("campusone.lastRole"); const el = roleInputs.find(x => x.value === r); if(el) el.checked = true; } catch(e) {}
roleInputs.forEach(r => r.addEventListener("change", () => {
  try { localStorage.setItem("campusone.lastRole", role()); } catch(e) {}
  showError(""); email.focus();
}));

const flash = Auth.takeFlash();
if(flash) (/^Password updated/.test(flash) ? showNote : showError)(flash);

if(!Auth.configured){
  $("setupWarning").hidden = false;
  if(!Auth.libLoaded) $("setupWarning").querySelector("small").textContent = "Couldn't load the sign-in library. Check your internet connection and reload.";
  busy(true);
}

$("togglePw").addEventListener("click", e => {
  const show = password.type === "password";
  password.type = show ? "text" : "password";
  e.currentTarget.setAttribute("aria-pressed", String(show));
  e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
  e.currentTarget.querySelector("use").setAttribute("href", show ? "#i-eye-off" : "#i-eye");
});

$("forgot").addEventListener("click", async () => {
  if(!Auth.configured) return;
  if(!email.value.trim() || !email.checkValidity()){
    showError("Enter your college email above, then click “Forgot password?” again.");
    email.setAttribute("aria-invalid",""); email.focus(); return;
  }
  const {error} = await Auth.resetPassword(email.value);
  if(error && /rate limit/i.test(error.message)) showError("Too many reset requests. Please wait a few minutes and try again.");
  else showNote("If that email has an account, a password reset link is on its way.");
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  if(!Auth.configured) return;
  const emailOk = email.value.trim() && email.checkValidity();
  email.toggleAttribute("aria-invalid", !emailOk);
  password.toggleAttribute("aria-invalid", !password.value);
  if(!emailOk || !password.value){
    showError(!email.value.trim() ? "Enter your college email and password." : !emailOk ? "Enter a valid email address." : "Enter your password.");
    (emailOk ? password : email).focus();
    return;
  }
  busy(true); showError("");
  try {
    const res = await Auth.signIn(role(), email.value, password.value, $("remember").checked);
    if(res.ok){ location.replace(Auth.homeFor(res.profile.role)); return; }
    showError(res.error);
    password.value = ""; password.focus();
  } catch(err) {
    showError("Couldn't reach the server. Check your connection and try again.");
  }
  busy(false);
});
