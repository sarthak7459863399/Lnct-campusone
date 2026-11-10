/*
 * Live timetable: renders #schedule from a list of periods, dims past ones, highlights
 * the current one and fills the hero "Up next" card. Used by the student and faculty pages.
 * Each page sets window.SCHEDULE before loading this file.
 */
(function(){
  const SCHEDULE = window.SCHEDULE || [];
  if(!SCHEDULE.length) return;
  const $ = id => document.getElementById(id);
  const mins = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };
  const fmtDur = m => m>=60 ? `${Math.floor(m/60)}h ${m%60 ? m%60+"m" : ""}`.trim() : `${m} min`;
  const set = (id, v) => { const el = $(id); if(el) el.textContent = v; };

  function render(){
    const d = new Date(), now = d.getHours()*60 + d.getMinutes();
    const state = s => mins(s.end)<=now ? "past" : mins(s.start)<=now ? "now" : "upcoming";

    if($("schedule")) $("schedule").innerHTML = SCHEDULE.map(s => {
      const st = state(s);
      return `<li class="class-row tone-${s.tone} ${st}"${st==="now"?' aria-current="time"':""}>
        <span class="time">${s.start}<small>${s.end}</small></span>
        <div class="class-info"><strong>${s.title}${st==="now"?'<span class="badge-now">NOW</span>':""}</strong><small>${s.place}</small></div>
        <span class="subject-code">${s.code}</span></li>`;
    }).join("");

    const classes = SCHEDULE.filter(s => !s.free);
    set("classCount", classes.length);
    if($("classSegments")) $("classSegments").innerHTML = classes.map(s => `<i class="${state(s)==="past"?"done":state(s)==="now"?"now":""}"></i>`).join("");
    const done = classes.filter(s => state(s)==="past").length;
    const upcoming = classes.find(s => state(s)!=="past");
    set("classSummary", upcoming ? `${done} done · Next: ${upcoming.title.replace("Engineering ","Engg. ")}` : "All classes done today");

    if(!$("nextCard")) return;
    const current = SCHEDULE.find(s => state(s)==="now");
    const next = SCHEDULE.find(s => state(s)==="upcoming" && !s.free);
    const show = current || next || SCHEDULE[0];
    $("nextCard").classList.toggle("live", !!current);
    set("nextTitle", show.title); set("nextRoom", show.place); set("nextTime", `${show.start} – ${show.end}`);
    const bar = $("nextProgress");
    if(current){
      const total = mins(current.end)-mins(current.start), gone = now-mins(current.start);
      set("nextLabel","In progress"); bar.style.width = Math.round(gone/total*100)+"%"; set("nextHint", `Ends in ${fmtDur(total-gone)}`);
    } else if(next){
      set("nextLabel","Up next"); bar.style.width = "0%"; set("nextHint", `Starts in ${fmtDur(mins(next.start)-now)}`);
    } else {
      set("nextLabel","Tomorrow"); bar.style.width = "100%"; set("nextHint", "You're done for today. First class tomorrow at " + SCHEDULE[0].start);
    }
  }
  render();
  setInterval(render, 60000);
})();
