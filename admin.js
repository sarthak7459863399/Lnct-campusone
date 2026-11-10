/* Admin console: searchable user table with approvals, notice publishing, activity feed (sample data, in-memory only). */
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const initials = n => n.replace(/^(Prof\.|Dr\.)\s*/,"").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase();
  const ROLE_TONE = {student:"blue", faculty:"teal", admin:"amber"};
  const ROLE_LABEL = {student:"Student", faculty:"Faculty", admin:"Admin"};

  const USERS = [
    {name:"Sarthak Gupta", id:"0103CS241001", role:"student", dept:"Computer Science", status:"active"},
    {name:"Prof. Neha Verma", id:"FAC1024", role:"faculty", dept:"Mathematics", status:"active"},
    {name:"Aditi Rao", id:"0103IT241014", role:"student", dept:"Information Technology", status:"pending"},
    {name:"Dr. Rakesh Pandey", id:"FAC0872", role:"faculty", dept:"Mechanical", status:"active"},
    {name:"Kabir Singh", id:"0103EC241033", role:"student", dept:"Electronics & Comm.", status:"pending"},
    {name:"Meera Nair", id:"0103CS241027", role:"student", dept:"Computer Science", status:"active"},
    {name:"Prof. Sunil Dubey", id:"FAC1107", role:"faculty", dept:"Civil", status:"pending"},
    {name:"Campus Admin", id:"admin", role:"admin", dept:"Administration", status:"active"}
  ];
  let filter = "all";

  function render(){
    const q = $("userSearch").value.trim().toLowerCase();
    const rows = USERS.filter(u =>
      (filter==="all" || (filter==="pending" ? u.status==="pending" : u.role===filter)) &&
      (!q || [u.name,u.id,u.dept].some(v => v.toLowerCase().includes(q))));
    $("userRows").innerHTML = rows.map(u => `<tr>
      <td><div class="who"><span class="mini-avatar tone-${ROLE_TONE[u.role]}">${initials(u.name)}</span><div><strong>${esc(u.name)}</strong><small>${esc(u.id)}</small></div></div></td>
      <td><span class="chip tone-${ROLE_TONE[u.role]}">${ROLE_LABEL[u.role]}</span></td>
      <td>${esc(u.dept)}</td>
      <td><span class="status ${u.status}">${u.status==="pending"?"Pending":"Active"}</span></td>
      <td style="text-align:right">${u.status==="pending"
        ? `<button type="button" class="btn-sm primary" data-approve="${esc(u.id)}">Approve</button>`
        : `<button type="button" class="btn-sm" data-manage="${esc(u.id)}">Manage</button>`}</td></tr>`).join("");
    $("noUsers").hidden = rows.length > 0;
    const pending = USERS.filter(u => u.status==="pending").length;
    $("pendingCount").textContent = pending;
    $("pendingHero").textContent = pending;
    $("pendingChip").textContent = pending ? "New accounts" : "All clear";
  }

  function log(icon, tone, html){
    const li = document.createElement("li");
    li.innerHTML = `<span class="dot-ic tone-${tone}"><svg class="i"><use href="#i-${icon}"/></svg></span><div><p>${html}</p><small>Just now</small></div>`;
    $("feed").prepend(li);
  }

  $("userSearch").addEventListener("input", render);
  document.querySelectorAll("[data-filter]").forEach(b => b.addEventListener("click", () => {
    filter = b.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(x => x.setAttribute("aria-pressed", String(x===b)));
    render();
  }));
  $("userRows").addEventListener("click", e => {
    const a = e.target.closest("[data-approve]"), m = e.target.closest("[data-manage]");
    if(a){
      const u = USERS.find(x => x.id===a.dataset.approve); u.status = "active"; render();
      log("check","green",`Approved <b>${esc(u.name)}</b> (${ROLE_LABEL[u.role]})`);
      showToast(`${u.name} approved (demo).`);
    } else if(m){
      const u = USERS.find(x => x.id===m.dataset.manage);
      showToast(`Managing ${u.name} is a demo feature.`);
    }
  });

  $("noticeForm").addEventListener("submit", e => {
    e.preventDefault();
    const text = $("noticeText").value.trim(); if(!text){ $("noticeText").focus(); return; }
    const audience = $("noticeAudience").value;
    const li = document.createElement("li");
    li.innerHTML = `<p>${esc(text)}</p><span class="meta"><span class="chip tone-blue">${esc(audience)}</span>Just now</span>`;
    $("posted").prepend(li);
    $("noticeText").value = "";
    log("megaphone","teal",`Notice published to <b>${esc(audience)}</b>`);
    showToast(`Notice published to ${audience} (demo).`);
  });

  render();
})();
