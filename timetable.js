/*
 * Live timetable renderer shared by the student and faculty pages.
 * Call window.renderTimetable(periods) with [{start:"09:00", end:"10:00", title, place, code, tone, free}].
 * Dims past periods, highlights the current one, fills the hero "Up next" card and the
 * "classes today" stat, and refreshes every minute.
 */
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const mins = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };
  const fmtDur = m => m>=60 ? `${Math.floor(m/60)}h ${m%60 ? m%60+"m" : ""}`.trim() : `${m} min`;
  const set = (id, v) => { const el = $(id); if(el) el.textContent = v; };
  let periods = [], timer = null;

  function render(){
    const d = new Date(), now = d.getHours()*60 + d.getMinutes();
    const state = s => mins(s.end)<=now ? "past" : mins(s.start)<=now ? "now" : "upcoming";
    const classes = periods.filter(s => !s.free);

    if($("schedule")) $("schedule").innerHTML = periods.length ? periods.map(s => {
      const st = state(s);
      return `<li class="class-row tone-${s.tone} ${st}"${st==="now"?' aria-current="time"':""}>
        <span class="time">${esc(s.start)}<small>${esc(s.end)}</small></span>
        <div class="class-info"><strong>${esc(s.title)}${st==="now"?'<span class="badge-now">NOW</span>':""}</strong><small>${esc(s.place || "")}</small></div>
        <span class="subject-code">${esc(s.code)}</span></li>`;
    }).join("") : `<li class="empty"><svg class="i"><use href="#i-calendar"/></svg>No classes scheduled today.</li>`;

    set("classCount", classes.length);
    if($("classSegments")) $("classSegments").innerHTML = classes.map(s => `<i class="${state(s)==="past"?"done":state(s)==="now"?"now":""}"></i>`).join("");
    const done = classes.filter(s => state(s)==="past").length;
    const upcoming = classes.find(s => state(s)!=="past");
    set("classSummary", !classes.length ? "Nothing scheduled today" : upcoming ? `${done} done · Next: ${upcoming.title.replace("Engineering ","Engg. ")}` : "All classes done today");

    if(!$("nextCard")) return;
    const current = classes.find(s => state(s)==="now");
    const next = classes.find(s => state(s)==="upcoming");
    const show = current || next;
    $("nextCard").classList.toggle("live", !!current);
    $("nextCard").classList.toggle("idle", !show);
    const bar = $("nextProgress");
    if(current){
      const total = mins(current.end)-mins(current.start), gone = now-mins(current.start);
      set("nextLabel","In progress"); bar.style.width = Math.round(gone/total*100)+"%"; set("nextHint", `Ends in ${fmtDur(total-gone)}`);
    } else if(next){
      set("nextLabel","Up next"); bar.style.width = "0%"; set("nextHint", `Starts in ${fmtDur(mins(next.start)-now)}`);
    }
    if(show){
      set("nextTitle", show.title); set("nextRoom", show.place || ""); set("nextTime", `${show.start} – ${show.end}`);
    } else {
      set("nextLabel", "Today"); bar.style.width = classes.length ? "100%" : "0%";
      set("nextTitle", classes.length ? "You're done for today" : "No classes today");
      set("nextRoom", classes.length ? "See you tomorrow" : "Enjoy the day off");
      set("nextTime", ""); set("nextHint", "");
    }
  }

  window.renderTimetable = list => {
    periods = list.slice().sort((a,b) => mins(a.start) - mins(b.start));
    render();
    clearInterval(timer); timer = setInterval(render, 60000);
  };
})();
