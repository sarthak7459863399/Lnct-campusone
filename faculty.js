/* Faculty dashboard: schedule, attendance marking, assignments and notices, all stored in Supabase. */
(async function(){
  const {profile} = await Auth.ready;
  if(!profile) return;
  const sb = Auth.client, U = UI, $ = id => document.getElementById(id);
  const today = U.today(), dow = new Date().getDay();
  const key = (courseId, section) => `${courseId}|${section}`;

  let slots = [], classes = [], students = [], marked = new Map(), selected = null, roster = new Map();

  /* ---- Load schedule, students and today's attendance ---- */
  const slotRes = await sb.from("timetable_slots")
    .select("id,section,day_of_week,start_time,end_time,room,course_id,course:courses(code,title)")
    .eq("faculty_id", profile.id).eq("kind", "class");
  if(slotRes.error){ renderTimetable([]); return U.fail("Couldn't load your timetable", slotRes.error); }
  slots = slotRes.data;

  const todays = slots.filter(s => s.day_of_week === dow);
  renderTimetable(todays.map(s => ({
    start:U.time(s.start_time), end:U.time(s.end_time), title:`${s.course.title} · ${s.section}`,
    place:s.room, code:s.course.code, tone:U.tone(s.section + s.course.code)
  })));

  // Distinct classes this teacher has (course + section), today's first.
  const seen = new Set();
  for(const s of [...todays.sort((a,b) => a.start_time.localeCompare(b.start_time)), ...slots]){
    const k = key(s.course_id, s.section);
    if(!seen.has(k)){ seen.add(k); classes.push({key:k, course_id:s.course_id, section:s.section, course:s.course, todayAt: s.day_of_week === dow ? U.time(s.start_time) : null}); }
  }
  const sections = [...new Set(slots.map(s => s.section))].sort();

  const [stuRes, attRes] = await Promise.all([
    sections.length ? sb.from("profiles").select("id,full_name,member_id,section").eq("role","student").eq("status","active").in("section", sections).order("full_name")
                    : Promise.resolve({data:[]}),
    sb.from("attendance").select("course_id,section,student_id,present").eq("class_date", today)
  ]);
  if(stuRes.error) U.fail("Couldn't load students", stuRes.error);
  if(attRes.error) U.fail("Couldn't load today's attendance", attRes.error);
  students = stuRes.data || [];
  for(const a of attRes.data || []){
    const k = key(a.course_id, a.section);
    if(!marked.has(k)) marked.set(k, new Map());
    marked.get(k).set(a.student_id, a.present);
  }

  $("studentCount").textContent = students.length;
  $("studentSub").textContent = sections.length ? `Across ${sections.length} section${sections.length > 1 ? "s" : ""}` : "No sections assigned";

  /* ---- Attendance ---- */
  function updatePending(){
    const todayClasses = classes.filter(c => c.todayAt);
    const pending = todayClasses.filter(c => !marked.has(c.key)).length;
    $("pendingCount").textContent = pending;
    $("pendingChip").textContent = !todayClasses.length ? "No classes today" : pending ? `${pending} class${pending > 1 ? "es" : ""} pending` : "All marked";
  }

  function renderClassButtons(){
    $("classSeg").innerHTML = classes.map(c => `<button type="button" data-class="${U.esc(c.key)}" aria-pressed="${c.key === selected?.key}">${U.esc(c.course.code)} · ${U.esc(c.section)}</button>`).join("");
  }

  function selectClass(c){
    selected = c;
    const prev = marked.get(c.key);
    const list = students.filter(s => s.section === c.section);
    roster = new Map(list.map(s => [s.id, prev ? prev.get(s.id) ?? true : true]));
    renderClassButtons(); renderRoster();
  }

  function renderRoster(){
    if(!selected){
      $("rosterSub").textContent = "You don't have any classes assigned yet. Ask an admin to add you to the timetable.";
      $("roster").innerHTML = ""; $("presentCount").textContent = ""; $("rosterState").textContent = "";
      $("markAll").disabled = $("submitAttendance").disabled = true; return;
    }
    const list = students.filter(s => s.section === selected.section);
    const done = marked.has(selected.key);
    $("rosterSub").textContent = `${selected.course.title} · ${selected.section}${selected.todayAt ? " · " + selected.todayAt : " · not scheduled today"} · Tap a student to toggle.`;
    $("roster").innerHTML = list.length ? list.map(s => {
      const on = roster.get(s.id);
      return `<li><span class="mini-avatar tone-${U.tone(s.id)}">${U.initials(s.full_name)}</span>
        <div><strong>${U.esc(s.full_name)}</strong><small>${U.esc(s.member_id || "")}</small></div>
        <button type="button" class="switch" role="switch" aria-checked="${on}" data-student="${s.id}">${on ? "Present" : "Absent"}</button></li>`;
    }).join("") : `<li class="empty">No approved students in ${U.esc(selected.section)} yet.</li>`;
    const present = [...roster.values()].filter(Boolean).length;
    $("presentCount").textContent = `${present} / ${list.length} present`;
    $("rosterState").textContent = done ? "Saved for today · you can still update it" : "Not saved yet";
    $("submitAttendance").textContent = done ? "Update attendance" : "Save attendance";
    $("markAll").disabled = $("submitAttendance").disabled = !list.length;
  }

  $("classSeg").addEventListener("click", e => {
    const b = e.target.closest("[data-class]"); if(!b) return;
    selectClass(classes.find(c => c.key === b.dataset.class));
  });
  $("roster").addEventListener("click", e => {
    const b = e.target.closest("[data-student]"); if(!b) return;
    roster.set(b.dataset.student, !roster.get(b.dataset.student));
    renderRoster();
    $("roster").querySelector(`[data-student="${b.dataset.student}"]`)?.focus();
  });
  $("markAll").addEventListener("click", () => { for(const k of roster.keys()) roster.set(k, true); renderRoster(); });
  $("submitAttendance").addEventListener("click", async () => {
    const btn = $("submitAttendance"); btn.disabled = true;
    const records = [...roster].map(([student_id, present]) => ({student_id, present}));
    const {data, error} = await sb.rpc("save_attendance", {p_course_id: selected.course_id, p_section: selected.section, p_date: today, p_records: records});
    btn.disabled = false;
    if(error) return U.fail("Couldn't save attendance", error);
    marked.set(selected.key, new Map(roster));
    renderRoster(); updatePending();
    showToast(`Attendance saved for ${selected.section} (${data} students).`);
  });

  const firstToday = classes.find(c => c.todayAt);
  if(classes.length) selectClass(firstToday || classes[0]); else renderRoster();
  updatePending();

  /* ---- Assignments & submissions ---- */
  $("asgClass").innerHTML = classes.map(c => `<option value="${U.esc(c.key)}">${U.esc(c.course.title)} · ${U.esc(c.section)}</option>`).join("");
  $("asgDue").min = today;

  async function loadAssignments(){
    const {data, error} = await sb.from("assignments")
      .select("id,title,due_at,section,course_id,course:courses(code,title),submissions(id,reviewed)")
      .order("due_at", {ascending:false}).limit(10);
    if(error){ $("reviews").innerHTML = `<li class="empty">Couldn't load assignments.</li>`; return U.fail("Couldn't load assignments", error); }
    const sizes = students.reduce((m,s) => (m[s.section] = (m[s.section] || 0) + 1, m), {});
    let toReview = 0;
    $("reviews").innerHTML = data.length ? data.map(a => {
      const total = sizes[a.section] || 0, done = a.submissions.length, open = a.submissions.filter(s => !s.reviewed).length;
      toReview += open;
      return `<li><div><strong>${U.esc(a.title)}</strong><small>${U.esc(a.section)} · ${U.esc(a.course.code)} · ${done}/${total} submitted · ${U.due(a.due_at)}</small></div>
        <button type="button" class="btn-sm" data-review="${a.id}" ${open ? "" : "disabled"}>${open ? `Review ${open}` : done ? "Reviewed" : "No work yet"}</button>
        <div class="bar"><i class="tone-${U.tone(a.section + a.course.code)}" style="width:${total ? Math.round(done/total*100) : 0}%"></i></div></li>`;
    }).join("") : `<li class="empty">No assignments yet. Create one below.</li>`;
    $("reviewCount").textContent = toReview;
    $("reviewChip").textContent = toReview ? "Submissions waiting" : "All reviewed";
    $("reviewPill").textContent = toReview ? `${toReview} to review` : "Up to date";
  }
  $("reviews").addEventListener("click", async e => {
    const b = e.target.closest("[data-review]"); if(!b) return;
    b.disabled = true;
    const {error} = await sb.from("submissions").update({reviewed:true}).eq("assignment_id", Number(b.dataset.review)).eq("reviewed", false);
    if(error){ b.disabled = false; return U.fail("Couldn't update submissions", error); }
    showToast("Submissions marked as reviewed.");
    loadAssignments();
  });
  $("assignmentForm").addEventListener("submit", async e => {
    e.preventDefault();
    const c = classes.find(x => x.key === $("asgClass").value);
    if(!c) return showToast("You need a class assigned before creating assignments.");
    const due = new Date(`${$("asgDue").value}T23:59:00`);
    const {error} = await sb.from("assignments").insert({course_id:c.course_id, section:c.section, title:$("asgTitle").value.trim(), due_at:due.toISOString()});
    if(error) return U.fail("Couldn't create assignment", error);
    e.target.reset(); e.target.closest("details").open = false;
    showToast(`Assignment created for ${c.section}.`);
    loadAssignments();
  });

  /* ---- Notices ---- */
  $("noticeAudience").innerHTML = sections.length ? sections.map(s => `<option>${U.esc(s)}</option>`).join("") : `<option value="">No sections</option>`;
  async function loadNotices(){
    const {data, error} = await sb.from("notices").select("id,title,body,section,created_at")
      .eq("author_id", profile.id).order("created_at", {ascending:false}).limit(5);
    if(error) return U.fail("Couldn't load your notices", error);
    $("posted").innerHTML = data.map(n => `<li><p><strong>${U.esc(n.title)}</strong>${n.body ? " — " + U.esc(n.body) : ""}</p>
      <span class="meta"><span class="chip tone-teal">${U.esc(n.section || "")}</span>${U.ago(n.created_at)}<button type="button" class="link-danger" data-delete="${n.id}">Delete</button></span></li>`).join("");
  }
  $("noticeForm").addEventListener("submit", async e => {
    e.preventDefault();
    const section = $("noticeAudience").value;
    if(!section) return showToast("You need a section assigned before posting notices.");
    const {error} = await sb.from("notices").insert({title:$("noticeTitle").value.trim(), body:$("noticeText").value.trim(), category:"Class", audience:"section", section});
    if(error) return U.fail("Couldn't post notice", error);
    e.target.reset();
    showToast(`Notice posted to ${section}.`);
    loadNotices();
  });
  $("posted").addEventListener("click", async e => {
    const b = e.target.closest("[data-delete]"); if(!b || !confirm("Delete this notice for everyone?")) return;
    const {error} = await sb.from("notices").delete().eq("id", Number(b.dataset.delete));
    if(error) return U.fail("Couldn't delete notice", error);
    loadNotices();
  });

  await Promise.all([loadAssignments(), loadNotices()]);
})();
