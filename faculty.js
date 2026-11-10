/* Faculty dashboard: attendance roster, submissions review, notice posting (sample data, in-memory only). */
(function(){
  const $ = id => document.getElementById(id);
  const tones = ["blue","teal","amber","pink","green"];
  const initials = n => n.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase();

  /* ---- Attendance ---- */
  const ROSTERS = {
    "CSE-A": {cls:"Engineering Mathematics · 09:00", students:["Aarav Sharma","Ananya Patel","Devansh Jain","Ishita Mishra","Kabir Singh","Meera Nair","Rohan Tiwari","Sanya Kapoor"]},
    "CSE-B": {cls:"Engineering Mathematics · 11:00", students:["Aditi Rao","Arjun Mehta","Diya Choudhary","Harsh Vardhan","Nikhil Joshi","Pooja Yadav","Riya Saxena","Vivaan Gupta"]}
  };
  const state = {}; // section -> {present:Set, submitted:bool}
  for(const k in ROSTERS) state[k] = {present:new Set(ROSTERS[k].students), submitted:false};
  let section = "CSE-A";

  function renderRoster(){
    const r = ROSTERS[section], s = state[section];
    $("rosterSub").textContent = `${r.cls} · Tap a student to toggle.`;
    $("roster").innerHTML = r.students.map((n,i) => {
      const on = s.present.has(n);
      return `<li><span class="mini-avatar tone-${tones[i%tones.length]}">${initials(n)}</span>
        <div><strong>${n}</strong><small>0103CS24${section==="CSE-A"?"1":"2"}${String(i+1).padStart(3,"0")}</small></div>
        <button type="button" class="switch" role="switch" aria-checked="${on}" data-name="${n}" ${s.submitted?"disabled":""}>${on?"Present":"Absent"}</button></li>`;
    }).join("");
    $("presentCount").textContent = `${s.present.size} / ${r.students.length} present`;
    $("rosterState").textContent = s.submitted ? "Submitted · locked for this class" : "Not submitted yet";
    $("submitAttendance").disabled = s.submitted;
    $("markAll").disabled = s.submitted;
    const pending = Object.values(state).filter(x=>!x.submitted).length;
    $("pendingCount").textContent = pending;
    $("pendingChip").textContent = pending ? `${pending} class${pending>1?"es":""} pending` : "All done";
  }
  $("roster").addEventListener("click", e => {
    const b = e.target.closest(".switch"); if(!b || b.disabled) return;
    const s = state[section].present, n = b.dataset.name;
    s.has(n) ? s.delete(n) : s.add(n);
    renderRoster();
    $("roster").querySelector(`[data-name="${n}"]`).focus();
  });
  document.querySelectorAll("[data-section]").forEach(b => b.addEventListener("click", () => {
    section = b.dataset.section;
    document.querySelectorAll("[data-section]").forEach(x => x.setAttribute("aria-pressed", String(x===b)));
    renderRoster();
  }));
  $("markAll").addEventListener("click", () => { state[section].present = new Set(ROSTERS[section].students); renderRoster(); });
  $("submitAttendance").addEventListener("click", () => {
    state[section].submitted = true; renderRoster();
    showToast(`Attendance saved for ${section}: ${state[section].present.size}/${ROSTERS[section].students.length} present (demo).`);
  });
  renderRoster();

  /* ---- Submissions ---- */
  const REVIEWS = [
    {title:"Unit 1 problem set", group:"CSE-A · Engineering Maths", done:28, total:31, toReview:12, tone:"blue"},
    {title:"Matrices worksheet", group:"CSE-B · Engineering Maths", done:22, total:30, toReview:8, tone:"teal"},
    {title:"Logic & proofs quiz", group:"CSE-A · Discrete Structures", done:30, total:31, toReview:4, tone:"pink"}
  ];
  function renderReviews(){
    $("reviews").innerHTML = REVIEWS.map((r,i) => `<li><div><strong>${r.title}</strong><small>${r.group} · ${r.done}/${r.total} submitted</small></div>
      <button type="button" class="btn-sm" data-review="${i}" ${r.toReview?"":"disabled"}>${r.toReview?`Review ${r.toReview}`:"Reviewed"}</button>
      <div class="bar"><i class="tone-${r.tone}" style="width:${Math.round(r.done/r.total*100)}%"></i></div></li>`).join("");
    const left = REVIEWS.reduce((a,r)=>a+r.toReview,0);
    $("reviewCount").textContent = left;
    $("reviewPill").textContent = left ? `${left} to review` : "All reviewed";
  }
  $("reviews").addEventListener("click", e => {
    const b = e.target.closest("[data-review]"); if(!b) return;
    const r = REVIEWS[b.dataset.review]; r.toReview = 0; renderReviews();
    showToast(`Marked "${r.title}" as reviewed (demo).`);
  });
  renderReviews();

  /* ---- Notices ---- */
  $("noticeForm").addEventListener("submit", e => {
    e.preventDefault();
    const text = $("noticeText").value.trim(); if(!text){ $("noticeText").focus(); return; }
    const li = document.createElement("li");
    const p = document.createElement("p"); p.textContent = text;
    const meta = document.createElement("span"); meta.className = "meta";
    const chip = document.createElement("span"); chip.className = "chip tone-blue"; chip.textContent = $("noticeAudience").value;
    meta.append(chip, "Just now");
    li.append(p, meta);
    $("posted").prepend(li);
    $("noticeText").value = "";
    showToast("Notice posted to " + chip.textContent + " (demo).");
  });
})();
