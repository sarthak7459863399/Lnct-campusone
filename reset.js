/* Password reset: the email link signs the user in temporarily; they set a new password here. */
(async function(){
  const $ = id => document.getElementById(id);
  const showError = msg => { $("formError").querySelector("span").textContent = msg || ""; $("formError").hidden = !msg; };
  if(!Auth.configured){ $("resetSub").textContent = "The backend isn't connected yet."; return; }

  // supabase-js reads the token from the link while starting up; getSession waits for that.
  const {data:{session}} = await Auth.client.auth.getSession();
  if(!session){
    $("resetSub").textContent = "This reset link is invalid or has expired. Go back to sign in and request a new one.";
    return;
  }
  $("resetSub").textContent = `Setting a new password for ${session.user.email}.`;
  $("resetFields").hidden = false;
  $("newPw").focus();

  $("resetForm").addEventListener("submit", async e => {
    e.preventDefault();
    const pw = $("newPw").value, confirm = $("confirmPw").value;
    if(pw.length < 8) return showError("Use at least 8 characters.");
    if(pw !== confirm) return showError("The two passwords don't match.");
    $("submitBtn").disabled = true; showError("");
    const {error} = await Auth.client.auth.updateUser({password: pw});
    if(error){ $("submitBtn").disabled = false; return showError(error.message); }
    Auth.flash("Password updated. Sign in with your new password.");
    await Auth.client.auth.signOut();
    location.replace("login.html");
  });
})();
