/* Admin console: live campus stats, user approvals and editing, notices and the activity log (Supabase). */
(async function(){
  const {profile: me} = await Auth.ready;
  if(!me) return;
  const sb = Auth.client, U = UI, $ = id => document.getElementById(id);
  const ROLE_TONE = {student:"blue", faculty:"teal", admin:"amber"};
  const ROLE_LABEL = {student:"Student", faculty:"Faculty", admin:"Admin"};
  let users = [], filter = "all";

  /* ---- Overview numbers ---- */
  async function loadOverview(){
    const {data, error} = await sb.rpc("admin_overview");
    if(error) return U.fail("Couldn't load campus stats", error);
    $("stuCount").textContent = data.students;
    $("facCount").textContent = data.faculty;
    $("deptSub").textContent = `${data.departments} department${data.departments === 1 ? "" : "s"}`;
    $("totalUsers").textContent = data.total_users;
    $("pendingHero").textContent = data.pending;
    $("markedToday").textContent = data.marked_today;
    $("noticesWeek").textContent = data.notices_week;
    $("updatedAt").textContent = "Updated " + new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
    const pct = data.attendance_pct;
    $("attPct").textContent = pct == null ? "–" : pct + "%";
    $("attRing").setAttribute("stroke-dasharray", `${pct || 0} 100`);
    $("attRing").classList.toggle("low", pct != null && pct < 75);
    $("deptBars").innerHTML = data.by_department.length ? data.by_department.map(d => {
      const low = d.pct < 75;
      return `<li class="${low ? "warn" : ""}"><span>${U.esc(d.name)}${low ? ' <svg class="i"><use href="#i-alert"/></svg>' : ""}</span><b>${d.pct}%</b>
        <div class="bar"><i ${low ? "" : `class="tone-${U.tone(d.name)}"`} style="width:${d.pct}%"></i>${low ? '<em style="left:75%"></em>' : ""}</div></li>`;
    }).join("") : `<li class="empty">No attendance recorded in the last 30 days.</li>`;
  }

  /* ---- Users ---- */
  async function loadUsers(){
    const {data, error} = await sb.from("profiles").select("*").order("status").order("role").order("full_name");
    if(error){ $("userRows").innerHTML = `<tr><td colspan="5" class="empty">Couldn't load users.</td></tr>`; return U.fail("Couldn't load users", error); }
    users = data;
    const pending = users.filter(u => u.status === "pending").length;
    $("pendingCount").textContent = pending;
    $("pendingChip").textContent = pending ? "Waiting for you" : "All clear";
    $("bellDot").hidden = !pending;
    $("deptList").innerHTML = [...new Set(users.map(u => u.department).filter(Boolean))].map(d => `<option value="${U.esc(d)}">`).join("");
    renderUsers();
  }

  function renderUsers(){
    const q = $("userSearch").value.trim().toLowerCase();
    const rows = users.filter(u =>
      (filter === "all" || (filter === "pending" ? u.status === "pending" : u.role === filter)) &&
      (!q || [u.full_name, u.member_id, u.department, u.section].some(v => (v || "").toLowerCase().includes(q))));
    $("userRows").innerHTML = rows.map(u => `<tr>
      <td><div class="who"><span class="mini-avatar tone-${ROLE_TONE[u.role]}">${U.initials(u.full_name)}</span><div><strong>${U.esc(u.full_name || "(no name)")}${u.id === me.id ? ' <small class="you">(you)</small>' : ""}</strong><small>${U.esc(u.member_id || "No ID yet")}</small></div></div></td>
      <td><span class="chip tone-${ROLE_TONE[u.role]}">${ROLE_LABEL[u.role]}</span></td>
      <td>${U.esc([u.department, u.section].filter(Boolean).join(" · ") || "—")}</td>
      <td><span class="status ${u.status}">${u.status === "pending" ? "Pending" : "Active"}</span></td>
      <td class="row-actions">${u.status === "pending" ? `<button type="button" class="btn-sm primary" data-approve="${u.id}">Approve</button>` : ""}<button type="button" class="btn-sm" data-edit="${u.id}">Edit</button></td></tr>`).join("");
    $("noUsers").hidden = rows.length > 0;
  }

  $("userSearch").addEventListener("input", renderUsers);
  document.querySelectorAll("[data-filter]").forEach(b => b.addEventListener("click", () => {
    filter = b.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    renderUsers();
  }));
  $("userRows").addEventListener("click", async e => {
    const a = e.target.closest("[data-approve]"), ed = e.target.closest("[data-edit]");
    if(a){
      const u = users.find(x => x.id === a.dataset.approve);
      if(!u.full_name || (u.role === "student" && !u.section)){ openEditor(u, true); return; }
      a.disabled = true;
      const {error} = await sb.from("profiles").update({status:"active"}).eq("id", u.id);
      if(error){ a.disabled = false; return U.fail("Couldn't approve", error); }
      showToast(`${u.full_name} approved as ${ROLE_LABEL[u.role].toLowerCase()}.`);
      refresh();
    } else if(ed){
      openEditor(users.find(x => x.id === ed.dataset.edit));
    }
  });

  /* ---- Edit dialog ---- */
  const dialog = $("userDialog"), form = $("userForm");
  let editing = null;
  function syncRoleFields(){
    const role = form.role.value;
    form.querySelectorAll("[data-for]").forEach(el => el.hidden = el.dataset.for !== role);
  }
  function dialogError(msg){ $("dialogError").querySelector("span").textContent = msg || ""; $("dialogError").hidden = !msg; }
  function openEditor(u, approving){
    editing = u; dialogError("");
    $("dialogTitle").textContent = approving ? "Complete details to approve" : "Edit user";
    for(const f of ["full_name","role","status","member_id","department","section","program","title"]) form[f].value = u[f] ?? "";
    if(approving) form.status.value = "active";
    const self = u.id === me.id;
    form.role.disabled = form.status.disabled = self;   // don't lock yourself out
    syncRoleFields();
    dialog.showModal();
    form.full_name.focus();
  }
  form.role.addEventListener("change", syncRoleFields);
  $("dialogClose").addEventListener("click", () => dialog.close());
  $("dialogCancel").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const v = f => form[f].value.trim() || null;
    const role = form.role.value;
    if(!v("full_name")) return dialogError("Enter a full name.");
    if(role === "student" && form.status.value === "active" && !v("section")) return dialogError("Students need a section (e.g. CSE-A) to see their timetable.");
    const update = {full_name:v("full_name"), member_id:v("member_id"), department:v("department"),
      section: role === "student" ? v("section") : null, program: role === "student" ? v("program") : null, title: role === "faculty" ? v("title") : null};
    if(editing.id !== me.id){ update.role = role; update.status = form.status.value; }
    $("dialogSave").disabled = true;
    const {error} = await sb.from("profiles").update(update).eq("id", editing.id);
    $("dialogSave").disabled = false;
    if(error) return dialogError(/duplicate key/i.test(error.message) ? "That enrollment / employee ID is already used by someone else." : error.message);
    dialog.close();
    showToast(`Saved ${update.full_name}.`);
    refresh();
  });

  /* ---- Notices ---- */
  async function loadNotices(){
    const {data, error} = await sb.from("notices").select("id,title,body,audience,section,created_at,author_name")
      .order("created_at", {ascending:false}).limit(6);
    if(error) return U.fail("Couldn't load notices", error);
    const label = n => n.audience === "section" ? n.section : {everyone:"Everyone", students:"All students", faculty:"All faculty"}[n.audience];
    $("posted").innerHTML = data.length ? data.map(n => `<li><p><strong>${U.esc(n.title)}</strong>${n.body ? " — " + U.esc(n.body) : ""}</p>
      <span class="meta"><span class="chip tone-blue">${U.esc(label(n))}</span>${U.ago(n.created_at)}${n.author_name ? " · " + U.esc(n.author_name) : ""}<button type="button" class="link-danger" data-delete="${n.id}">Delete</button></span></li>`).join("")
      : `<li class="empty">No notices yet.</li>`;
  }
  $("noticeForm").addEventListener("submit", async e => {
    e.preventDefault();
    const audience = $("noticeAudience").value;
    const {error} = await sb.from("notices").insert({title:$("noticeTitle").value.trim(), body:$("noticeText").value.trim(), category:$("noticeCategory").value, audience});
    if(error) return U.fail("Couldn't publish notice", error);
    e.target.reset();
    showToast("Notice published.");
    loadNotices(); loadFeed(); loadOverview();
  });
  $("posted").addEventListener("click", async e => {
    const b = e.target.closest("[data-delete]"); if(!b || !confirm("Delete this notice for everyone?")) return;
    const {error} = await sb.from("notices").delete().eq("id", Number(b.dataset.delete));
    if(error) return U.fail("Couldn't delete notice", error);
    loadNotices(); loadOverview();
  });

  /* ---- Activity ---- */
  const ACTION_ICON = [[/^approved/,"check","green"],[/role/,"shield","amber"],[/attendance/,"tasks","blue"],[/notice/,"megaphone","teal"]];
  async function loadFeed(){
    const {data, error} = await sb.from("activity_log").select("id,action,created_at,actor:profiles(full_name)")
      .order("created_at", {ascending:false}).limit(12);
    if(error) return U.fail("Couldn't load activity", error);
    $("feed").innerHTML = data.length ? data.map(a => {
      const [, icon, tone] = ACTION_ICON.find(([re]) => re.test(a.action)) || [null, "activity", "pink"];
      return `<li><span class="dot-ic tone-${tone}"><svg class="i"><use href="#i-${icon}"/></svg></span><div><p><b>${U.esc(a.actor?.full_name || "System")}</b> ${U.esc(a.action)}</p><small>${U.ago(a.created_at)}</small></div></li>`;
    }).join("") : `<li class="empty">No activity yet.</li>`;
  }

  function refresh(){ return Promise.all([loadOverview(), loadUsers(), loadFeed()]); }
  await Promise.all([refresh(), loadNotices()]);
})();
