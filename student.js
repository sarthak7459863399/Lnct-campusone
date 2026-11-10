/* Student dashboard: loads the timetable, attendance, notices and assignments from Supabase. */
(async function(){
  const {profile} = await Auth.ready;
  if(!profile) return;
  const sb = Auth.client, U = UI, $ = id => document.getElementById(id);
  const SEEN = "campusone.noticesSeen";

  /* ---- Today's timetable ---- */
  async function loadTimetable(){
    if(!profile.section){ renderTimetable([]); $("classSummary").textContent = "No section assigned yet"; return; }
    const {data, error} = await sb.from("timetable_slots")
      .select("start_time,end_time,kind,room,label,course:courses(code,title)")
      .eq("section", profile.section).eq("day_of_week", new Date().getDay());
    if(error){ renderTimetable([]); return U.fail("Couldn't load timetable", error); }
    renderTimetable(data.map(s => s.kind === "free"
      ? {start:U.time(s.start_time), end:U.time(s.end_time), title:s.label || "Free period", place:"Use this time to revise or relax", code:"FREE", tone:"amber", free:true}
      : {start:U.time(s.start_time), end:U.time(s.end_time), title:s.course.title, place:s.room, code:s.course.code, tone:U.tone(s.course.code)}));
  }

  /* ---- Attendance ---- */
  async function loadAttendance(){
    const {data, error} = await sb.rpc("my_attendance");
    if(error){ $("attSub").textContent = "Couldn't load"; return U.fail("Couldn't load attendance", error); }
    const attended = data.reduce((a,r) => a + r.attended, 0), total = data.reduce((a,r) => a + r.total, 0);
    const pct = total ? Math.round(attended / total * 100) : 0;
    $("attPct").textContent = total ? pct + "%" : "–";
    $("attSub").textContent = total ? `${attended} of ${total} classes` : "No classes marked yet";
    $("attSub").className = total && pct < 75 ? "trend down" : "trend up";
    $("attRing").setAttribute("stroke-dasharray", `${pct} 100`);
    $("attRing").classList.toggle("low", total > 0 && pct < 75);

    $("subjectBars").innerHTML = data.length ? data.map(r => {
      const p = Math.round(r.attended / r.total * 100), low = p < 75;
      return `<li class="${low ? "warn" : ""}"><span>${U.esc(r.course_title)}${low ? ' <svg class="i"><use href="#i-alert"/></svg>' : ""}</span><b>${p}%</b>
        <div class="bar" title="${r.attended} of ${r.total} classes"><i ${low ? "" : `class="tone-${U.tone(r.course_code)}"`} style="width:${p}%"></i>${low ? '<em style="left:75%"></em>' : ""}</div></li>`;
    }).join("") : `<li class="empty">Attendance will appear once your teachers start marking it.</li>`;
  }

  /* ---- Notices ---- */
  const CATEGORY_STYLE = {Academic:["megaphone","blue"], Class:["clipboard","amber"], "Campus life":["cap","green"]};
  async function loadNotices(){
    const {data, error} = await sb.from("notices").select("id,title,body,category,created_at,author_name")
      .order("created_at", {ascending:false}).limit(8);
    if(error){ $("noticeList").innerHTML = U.empty("Couldn't load notices.", "alert"); return U.fail("Couldn't load notices", error); }
    let seen = 0; try { seen = Number(localStorage.getItem(SEEN)) || 0; } catch(e) {}
    const unread = data.filter(n => new Date(n.created_at).getTime() > seen).length;
    const week = data.filter(n => Date.now() - new Date(n.created_at) < 7*86400000).length;
    $("noticeCount").textContent = week;
    $("noticeChip").textContent = unread ? `${unread} new` : "This week";
    $("bellDot").hidden = !unread;
    $("bellBtn").setAttribute("aria-label", unread ? `Notices, ${unread} new` : "Notices");
    $("noticeList").innerHTML = data.length ? data.map(n => {
      const [icon, tone] = CATEGORY_STYLE[n.category] || ["bell","pink"];
      const isNew = new Date(n.created_at).getTime() > seen;
      return `<article class="notice${isNew ? " unread" : ""}"><div class="notice-symbol tone-${tone}"><svg class="i"><use href="#i-${icon}"/></svg></div>
        <div class="notice-body"><div class="notice-title"><strong>${U.esc(n.title)}</strong><small>${U.ago(n.created_at)}</small></div>
        ${n.body ? `<p>${U.esc(n.body)}</p>` : ""}<span class="chip tone-${tone}">${U.esc(n.category)}</span>${n.author_name ? `<small class="byline">· ${U.esc(n.author_name)}</small>` : ""}</div></article>`;
    }).join("") : U.empty("No notices yet.", "bell");
    try { localStorage.setItem(SEEN, String(Date.now())); } catch(e) {}
  }

  /* ---- Assignments ---- */
  async function loadAssignments(){
    const since = new Date(Date.now() - 7*86400000).toISOString();
    const [a, s] = await Promise.all([
      sb.from("assignments").select("id,title,description,due_at,course:courses(code,title)").gte("due_at", since).order("due_at"),
      sb.from("submissions").select("assignment_id,reviewed")
    ]);
    const error = a.error || s.error;
    if(error){ $("assignmentList").innerHTML = U.empty("Couldn't load assignments.", "alert"); return U.fail("Couldn't load assignments", error); }
    const subs = new Map(s.data.map(x => [x.assignment_id, x]));
    const pending = a.data.filter(x => !subs.has(x.id) && new Date(x.due_at) > Date.now());
    $("asgCount").textContent = pending.length;
    $("asgChip").textContent = pending.length ? U.due(pending[0].due_at) : "All caught up";
    $("assignmentList").innerHTML = a.data.length ? a.data.map(x => {
      const sub = subs.get(x.id), late = !sub && new Date(x.due_at) < Date.now();
      const action = sub ? `<span class="chip tone-green">${sub.reviewed ? "Reviewed" : "Submitted"}</span>`
        : late ? `<span class="chip tone-pink">Overdue</span>`
        : `<button type="button" class="btn-sm primary" data-submit="${x.id}">Mark submitted</button>`;
      return `<li><div><strong>${U.esc(x.title)}</strong><small>${U.esc(x.course.title)} · ${sub ? "Done" : U.due(x.due_at)}</small></div>${action}</li>`;
    }).join("") : `<li class="empty">No assignments right now.</li>`;
  }
  $("assignmentList").addEventListener("click", async e => {
    const b = e.target.closest("[data-submit]"); if(!b) return;
    b.disabled = true;
    const {error} = await sb.from("submissions").insert({assignment_id: Number(b.dataset.submit)});
    if(error){ b.disabled = false; return U.fail("Couldn't submit", error); }
    showToast("Marked as submitted.");
    loadAssignments();
  });

  await Promise.all([loadTimetable(), loadAttendance(), loadNotices(), loadAssignments()]);
})();
