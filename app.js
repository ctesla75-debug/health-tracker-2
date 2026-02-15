/* Health Tracker - Offline
   - IndexedDB storage (no cloud)
   - PWA offline via service worker
   - Simple charting with Canvas (no external libraries)
*/

const DB_NAME = "health_tracker_db";
const DB_VERSION = 1;
const STORE = "logs";

/** Supplements and exercises - per your spec */
const SUPPLEMENTS = [
  { id:"berberine_morning", name:"Berberine – Morning", time:"Morning" },
  { id:"vitamin_d3", name:"Vitamin D3", time:"Morning" },
  { id:"vitamin_k2", name:"Vitamin K2", time:"Morning" },
  { id:"nr", name:"NR", time:"Morning" },
  { id:"astaxanthin", name:"Astaxanthin", time:"Morning" },
  { id:"metformin", name:"Metformin", time:"Morning" },
  { id:"berberine_afternoon", name:"Berberine – Afternoon", time:"Afternoon" },
  { id:"vitamin_c", name:"Vitamin C", time:"Afternoon" },
  { id:"multivitamin", name:"Multivitamin", time:"Afternoon" },
  { id:"sugar_support", name:"Sugar Support", time:"Afternoon" },
  { id:"omega_3", name:"Omega 3", time:"Afternoon" },
  { id:"tmg", name:"TMG", time:"Afternoon" },
  { id:"nac", name:"NAC", time:"Evening" },
  { id:"magnesium", name:"Magnesium", time:"Evening" },
  { id:"taurine", name:"Taurine", time:"Evening" },
  { id:"collagen", name:"Collagen", time:"Evening" },
  { id:"protein_powder", name:"Protein Powder 84g", time:"Evening" },
  { id:"cinnamon", name:"Cinnamon", time:"Evening" },
  { id:"apple_cider_vinegar", name:"Apple Cider Vinegar", time:"Evening" },
  { id:"creatine", name:"Creatine 10g", time:"Evening" },
  { id:"probiotic", name:"Probiotic", time:"Evening" },
  { id:"ubiquinol", name:"Ubiquinol", time:"Evening" },
];

const EXERCISES = [
  { id:"treadmill", name:"Half Hour Treadmill" },
  { id:"foot_exercise", name:"Foot Exercise" },
  { id:"shoulder_exercise", name:"Shoulder Exercise" },
  { id:"weight_training", name:"Weight Training" },
];

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function uuid(){
  // Stable-enough local-only id
  return (crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);
}

/* ---------- IndexedDB ---------- */

function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE)){
        const store = db.createObjectStore(STORE, { keyPath:"date" }); // unique per date
        store.createIndex("date", "date", { unique:true });
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}

async function putLog(log){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(log);
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  });
}

async function getLog(date){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(date);
    req.onsuccess = ()=> resolve(req.result ?? null);
    req.onerror = ()=> reject(req.error);
  });
}

async function deleteLog(date){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(date);
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  });
}

async function getAllLogs(){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = ()=> resolve(req.result ?? []);
    req.onerror = ()=> reject(req.error);
  });
}

async function clearAll(){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  });
}

async function clearRange(fromISO, toISO){
  // inclusive range
  const all = await getAllLogs();
  const keep = all.filter(l => !(l.date >= fromISO && l.date <= toISO));
  await clearAll();
  for(const l of keep) await putLog(l);
}

function sortByDateAsc(logs){
  return [...logs].sort((a,b)=> (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
function sortByDateDesc(logs){
  return [...logs].sort((a,b)=> (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

/* ---------- UI helpers ---------- */

const $ = (sel)=> document.querySelector(sel);

function setStatus(msg, good=true){
  const el = $("#saveStatus");
  if(!el) return;
  el.textContent = msg;
  el.style.color = good ? "" : "var(--danger)";
}

function safeNum(v){
  if(v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function makeEmptyLog(date){
  const supp = {};
  for(const s of SUPPLEMENTS) supp[s.id] = false;
  const ex = {};
  for(const e of EXERCISES) ex[e.id] = false;
  return {
    id: uuid(),
    date,
    supplements: supp,
    custom_vitamin_name: "",
    custom_vitamin_taken: false,
    exercises: ex,
    fasted: false,
    water_fasted: false,
    fasting_blood_sugar: null,
    pre_dinner_sugar: null,
    post_dinner_sugar: null,
    waist_size: null,
    weight: null,
    fat_percentage: null,
    blood_pressure_systolic: null,
    blood_pressure_diastolic: null,
    grip_strength_left: null,
    grip_strength_right: null
  };
}

function buildCheck(parent, id, label, sublabel=""){
  const wrap = document.createElement("label");
  wrap.className = "check";
  wrap.innerHTML = `
    <input type="checkbox" data-id="${id}">
    <div class="meta">
      <div class="name">${escapeHtml(label)}</div>
      ${sublabel ? `<div class="time">${escapeHtml(sublabel)}</div>` : ""}
    </div>
  `;
  parent.appendChild(wrap);
}

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[s]));
}

function setCheckboxes(containerSel, obj){
  const container = $(containerSel);
  if(!container) return;
  container.querySelectorAll("input[type=checkbox][data-id]").forEach(cb=>{
    const id = cb.getAttribute("data-id");
    cb.checked = !!obj?.[id];
  });
}

function readCheckboxes(containerSel){
  const container = $(containerSel);
  const out = {};
  if(!container) return out;
  container.querySelectorAll("input[type=checkbox][data-id]").forEach(cb=>{
    const id = cb.getAttribute("data-id");
    out[id] = cb.checked;
  });
  return out;
}

function renderSupplementSummary(log){
  const el = $("#supplementSummary");
  if(!el) return;
  const total = SUPPLEMENTS.length + (log.custom_vitamin_name?.trim() ? 1 : 0);
  const taken = SUPPLEMENTS.reduce((acc,s)=> acc + (log.supplements?.[s.id] ? 1 : 0), 0)
              + (log.custom_vitamin_name?.trim() && log.custom_vitamin_taken ? 1 : 0);
  const pct = total ? Math.round((taken/total)*100) : 0;
  el.innerHTML = `
    <div class="pill"><strong>${taken}</strong> / ${total} taken</div>
    <div class="pill"><strong>${pct}%</strong> complete</div>
  `;
}

/* ---------- Tabs ---------- */

function setupTabs(){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".tab").forEach(b=> b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".panel").forEach(p=> p.classList.remove("active"));
      $("#panel-"+btn.dataset.tab).classList.add("active");

      // refresh per tab
      if(btn.dataset.tab === "history") refreshHistory();
      if(btn.dataset.tab === "charts") refreshCharts();
      if(btn.dataset.tab === "settings") refreshOfflineBadge();
    });
  });
}

/* ---------- Daily log screen ---------- */

function buildDynamicLists(){
  const m = $("#suppMorning");
  const a = $("#suppAfternoon");
  const e = $("#suppEvening");
  for(const s of SUPPLEMENTS){
    const target = s.time==="Morning" ? m : s.time==="Afternoon" ? a : e;
    buildCheck(target, s.id, s.name, s.time);
  }

  const ex = $("#exerciseChecks");
  for(const x of EXERCISES){
    buildCheck(ex, x.id, x.name, "");
  }

  // Live summary updates
  ["#suppMorning", "#suppAfternoon", "#suppEvening"].forEach(sel=>{
    $(sel).addEventListener("change", async ()=>{
      const date = $("#logDate").value || todayISO();
      const log = await collectFormIntoLog(makeEmptyLog(date));
      renderSupplementSummary(log);
    });
  });
  $("#customVitaminName").addEventListener("input", async ()=>{
    const date = $("#logDate").value || todayISO();
    const log = await collectFormIntoLog(makeEmptyLog(date));
    renderSupplementSummary(log);
  });
  $("#customVitaminTaken").addEventListener("change", async ()=>{
    const date = $("#logDate").value || todayISO();
    const log = await collectFormIntoLog(makeEmptyLog(date));
    renderSupplementSummary(log);
  });
}

async function loadDate(date){
  $("#logDate").value = date;
  let log = await getLog(date);
  if(!log) log = makeEmptyLog(date);

  // supplements
  setCheckboxes("#suppMorning", log.supplements);
  setCheckboxes("#suppAfternoon", log.supplements);
  setCheckboxes("#suppEvening", log.supplements);

  $("#customVitaminName").value = log.custom_vitamin_name ?? "";
  $("#customVitaminTaken").checked = !!log.custom_vitamin_taken;

  // exercises
  setCheckboxes("#exerciseChecks", log.exercises);

  // fasting
  $("#fasted").checked = !!log.fasted;
  $("#waterFasted").checked = !!log.water_fasted;

  // numbers
  $("#fastingBloodSugar").value = log.fasting_blood_sugar ?? "";
  $("#preDinnerSugar").value = log.pre_dinner_sugar ?? "";
  $("#postDinnerSugar").value = log.post_dinner_sugar ?? "";
  $("#waistSize").value = log.waist_size ?? "";
  $("#weight").value = log.weight ?? "";
  $("#fatPercentage").value = log.fat_percentage ?? "";
  $("#bpSystolic").value = log.blood_pressure_systolic ?? "";
  $("#bpDiastolic").value = log.blood_pressure_diastolic ?? "";
  $("#gripLeft").value = log.grip_strength_left ?? "";
  $("#gripRight").value = log.grip_strength_right ?? "";

  renderSupplementSummary(log);
  setStatus(`Loaded ${date}.`, true);
}

async function collectFormIntoLog(existing){
  const date = $("#logDate").value || existing.date || todayISO();
  const log = existing ?? makeEmptyLog(date);
  log.date = date;

  const supp = {
    ...readCheckboxes("#suppMorning"),
    ...readCheckboxes("#suppAfternoon"),
    ...readCheckboxes("#suppEvening"),
  };
  // Ensure all supplement keys exist
  for(const s of SUPPLEMENTS){
    if(typeof supp[s.id] !== "boolean") supp[s.id] = false;
  }

  log.supplements = supp;
  log.custom_vitamin_name = ($("#customVitaminName").value ?? "").trim();
  log.custom_vitamin_taken = !!$("#customVitaminTaken").checked;

  const ex = readCheckboxes("#exerciseChecks");
  for(const x of EXERCISES){
    if(typeof ex[x.id] !== "boolean") ex[x.id] = false;
  }
  log.exercises = ex;

  log.fasted = !!$("#fasted").checked;
  log.water_fasted = !!$("#waterFasted").checked;

  log.fasting_blood_sugar = safeNum($("#fastingBloodSugar").value);
  log.pre_dinner_sugar = safeNum($("#preDinnerSugar").value);
  log.post_dinner_sugar = safeNum($("#postDinnerSugar").value);

  log.waist_size = safeNum($("#waistSize").value);
  log.weight = safeNum($("#weight").value);
  log.fat_percentage = safeNum($("#fatPercentage").value);

  log.blood_pressure_systolic = safeNum($("#bpSystolic").value);
  log.blood_pressure_diastolic = safeNum($("#bpDiastolic").value);

  log.grip_strength_left = safeNum($("#gripLeft").value);
  log.grip_strength_right = safeNum($("#gripRight").value);

  return log;
}

async function saveCurrent(){
  const date = $("#logDate").value || todayISO();
  const existing = await getLog(date);
  const base = existing ?? makeEmptyLog(date);
  const log = await collectFormIntoLog(base);
  if(!log.id) log.id = uuid();
  await putLog(log);
  renderSupplementSummary(log);
  setStatus(`Saved ${date} locally.`, true);
}

async function deleteCurrentDay(){
  const date = $("#logDate").value || todayISO();
  const existing = await getLog(date);
  if(!existing){
    setStatus(`Nothing to delete for ${date}.`, false);
    return;
  }
  if(!confirm(`Delete log for ${date}?`)) return;
  await deleteLog(date);
  await loadDate(date); // reload -> empty
  setStatus(`Deleted ${date}.`, true);
}

/* ---------- History ---------- */

function formatYesNo(v){ return v ? "Yes" : "No"; }

function countTrue(obj){
  if(!obj) return 0;
  return Object.values(obj).reduce((a,v)=> a + (v===true ? 1 : 0), 0);
}

function kvRow(k,v){
  const row = document.createElement("div");
  row.className = "kv";
  row.innerHTML = `<div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div>`;
  return row;
}

function listTakenSupps(log){
  const taken = SUPPLEMENTS.filter(s=> log.supplements?.[s.id]).map(s=> s.name);
  if(log.custom_vitamin_name?.trim() && log.custom_vitamin_taken) taken.push(log.custom_vitamin_name.trim());
  return taken;
}

function listDoneExercises(log){
  const done = EXERCISES.filter(e=> log.exercises?.[e.id]).map(e=> e.name);
  return done;
}

function matchesSearch(log, q){
  if(!q) return true;
  q = q.toLowerCase();
  if(log.date?.includes(q)) return true;
  if(log.custom_vitamin_name?.toLowerCase().includes(q)) return true;
  const taken = listTakenSupps(log).join(" ").toLowerCase();
  const done = listDoneExercises(log).join(" ").toLowerCase();
  if(taken.includes(q) || done.includes(q)) return true;
  return false;
}

async function refreshHistory(){
  const list = $("#historyList");
  if(!list) return;

  const q = ($("#historySearch").value ?? "").trim();
  const limit = Number($("#historyLimit").value ?? 30);

  let logs = sortByDateDesc(await getAllLogs());
  if(Number.isFinite(limit) && limit < 99999) logs = logs.slice(0, limit);
  if(q) logs = logs.filter(l => matchesSearch(l, q));

  list.innerHTML = "";
  if(logs.length === 0){
    list.innerHTML = `<div class="muted">No logs found.</div>`;
    return;
  }

  for(const log of logs){
    const details = document.createElement("details");
    details.className = "acc";
    details.open = false; // collapsed by default
    const suppCount = countTrue(log.supplements) + (log.custom_vitamin_name?.trim() ? 1 : 0);
    const exCount = countTrue(log.exercises);

    const summary = document.createElement("summary");
    summary.innerHTML = `
      <div>
        <div style="font-weight:900">${escapeHtml(log.date)}</div>
        <div class="small muted">${suppCount} supplements • ${exCount} exercises • Fasted: ${formatYesNo(log.fasted)}</div>
      </div>
      <div class="small muted">Open</div>
    `;

    const body = document.createElement("div");
    body.className = "accbody";

    const btnBar = document.createElement("div");
    btnBar.className = "btnrow";
    btnBar.style.marginBottom = "8px";
    btnBar.innerHTML = `
      <button class="btn" type="button" data-action="edit" data-date="${log.date}">Edit</button>
      <button class="btn danger" type="button" data-action="delete" data-date="${log.date}">Delete</button>
    `;

    const taken = listTakenSupps(log);
    const done = listDoneExercises(log);

    body.appendChild(btnBar);
    body.appendChild(kvRow("Supplements taken", taken.length ? taken.join(", ") : "None"));
    body.appendChild(kvRow("Exercises", done.length ? done.join(", ") : "None"));
    body.appendChild(kvRow("Fasted", formatYesNo(log.fasted)));
    body.appendChild(kvRow("Water fasted", formatYesNo(log.water_fasted)));

    body.appendChild(kvRow("Fasting blood sugar (mmol/L)", log.fasting_blood_sugar ?? ""));
    body.appendChild(kvRow("Pre-dinner sugar (mmol/L)", log.pre_dinner_sugar ?? ""));
    body.appendChild(kvRow("Post-dinner sugar (mmol/L)", log.post_dinner_sugar ?? ""));

    body.appendChild(kvRow("Waist (cm)", log.waist_size ?? ""));
    body.appendChild(kvRow("Weight (kg)", log.weight ?? ""));
    body.appendChild(kvRow("Fat (%)", log.fat_percentage ?? ""));

    body.appendChild(kvRow("BP (mmHg)", `${log.blood_pressure_systolic ?? ""} / ${log.blood_pressure_diastolic ?? ""}`));
    body.appendChild(kvRow("Grip (kg)", `L ${log.grip_strength_left ?? ""} • R ${log.grip_strength_right ?? ""}`));

    details.appendChild(summary);
    details.appendChild(body);
    list.appendChild(details);
  }

  // actions
  list.querySelectorAll("button[data-action]").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      e.stopPropagation();
      const action = btn.dataset.action;
      const date = btn.dataset.date;
      if(action === "edit"){
        // switch tab and load
        document.querySelector('.tab[data-tab="log"]').click();
        await loadDate(date);
      }else if(action === "delete"){
        if(confirm(`Delete log for ${date}?`)){
          await deleteLog(date);
          await refreshHistory();
          await refreshCharts();
        }
      }
    });
  });
}

/* ---------- Export / Import ---------- */

function downloadBlob(filename, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 1500);
}

function toCSV(logs){
  // Flatten to columns
  const suppCols = SUPPLEMENTS.map(s=> `supp_${s.id}`);
  const exCols = EXERCISES.map(e=> `ex_${e.id}`);
  const cols = [
    "id","date",
    ...suppCols,
    "custom_vitamin_name","custom_vitamin_taken",
    ...exCols,
    "fasted","water_fasted",
    "fasting_blood_sugar","pre_dinner_sugar","post_dinner_sugar",
    "waist_size","weight","fat_percentage",
    "blood_pressure_systolic","blood_pressure_diastolic",
    "grip_strength_left","grip_strength_right",
  ];

  const esc = (v)=>{
    const s = (v ?? "").toString();
    if(/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };

  const lines = [];
  lines.push(cols.join(","));
  for(const l of logs){
    const row = [];
    row.push(l.id ?? "");
    row.push(l.date ?? "");
    for(const s of SUPPLEMENTS) row.push(l.supplements?.[s.id] ? "1" : "0");
    row.push(l.custom_vitamin_name ?? "");
    row.push(l.custom_vitamin_taken ? "1" : "0");
    for(const e of EXERCISES) row.push(l.exercises?.[e.id] ? "1" : "0");
    row.push(l.fasted ? "1" : "0");
    row.push(l.water_fasted ? "1" : "0");
    row.push(l.fasting_blood_sugar ?? "");
    row.push(l.pre_dinner_sugar ?? "");
    row.push(l.post_dinner_sugar ?? "");
    row.push(l.waist_size ?? "");
    row.push(l.weight ?? "");
    row.push(l.fat_percentage ?? "");
    row.push(l.blood_pressure_systolic ?? "");
    row.push(l.blood_pressure_diastolic ?? "");
    row.push(l.grip_strength_left ?? "");
    row.push(l.grip_strength_right ?? "");
    lines.push(row.map(esc).join(","));
  }
  return lines.join("\n");
}

async function exportJSON(){
  const logs = sortByDateAsc(await getAllLogs());
  const blob = new Blob([JSON.stringify(logs, null, 2)], {type:"application/json"});
  downloadBlob(`health-tracker-export-${todayISO()}.json`, blob);
}

async function exportCSV(){
  const logs = sortByDateAsc(await getAllLogs());
  const blob = new Blob([toCSV(logs)], {type:"text/csv"});
  downloadBlob(`health-tracker-export-${todayISO()}.csv`, blob);
}

async function importJSON(){
  const file = $("#importFile").files?.[0];
  if(!file){ alert("Choose a JSON file first."); return; }

  let data;
  try{
    const text = await file.text();
    data = JSON.parse(text);
  }catch(e){
    alert("That file doesn't look like valid JSON.");
    return;
  }

  const items = Array.isArray(data) ? data : [data];
  let count = 0;

  for(const raw of items){
    if(!raw || typeof raw !== "object") continue;
    const date = raw.date;
    if(!date || typeof date !== "string") continue;
    const base = makeEmptyLog(date);

    // Merge - overwrite by date
    const merged = {
      ...base,
      ...raw,
      date,
      id: raw.id ?? base.id,
      supplements: { ...base.supplements, ...(raw.supplements ?? {}) },
      exercises: { ...base.exercises, ...(raw.exercises ?? {}) },
    };

    // normalise numbers
    const numFields = [
      "fasting_blood_sugar","pre_dinner_sugar","post_dinner_sugar",
      "waist_size","weight","fat_percentage",
      "blood_pressure_systolic","blood_pressure_diastolic",
      "grip_strength_left","grip_strength_right"
    ];
    for(const f of numFields){
      merged[f] = (merged[f] === "" || merged[f] === undefined) ? null :
                 (Number.isFinite(Number(merged[f])) ? Number(merged[f]) : null);
    }
    merged.fasted = !!merged.fasted;
    merged.water_fasted = !!merged.water_fasted;
    merged.custom_vitamin_name = (merged.custom_vitamin_name ?? "").toString();
    merged.custom_vitamin_taken = !!merged.custom_vitamin_taken;

    await putLog(merged);
    count++;
  }

  alert(`Imported ${count} log(s).`);
  await refreshHistory();
  await refreshCharts();
}

/* ---------- Charts (Canvas) ---------- */

function scaleLinear(domainMin, domainMax, rangeMin, rangeMax){
  const d = (domainMax - domainMin) || 1;
  const r = (rangeMax - rangeMin);
  return (x)=> rangeMin + ((x - domainMin) / d) * r;
}

function niceMinMax(values){
  const vals = values.filter(v => Number.isFinite(v));
  if(vals.length === 0) return {min:0, max:1};
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if(min === max){
    min = min - 1;
    max = max + 1;
  }
  const pad = (max - min) * 0.08;
  return {min: min - pad, max: max + pad};
}

function drawAxes(ctx, w, h, pad, yMin, yMax, yLabel){
  ctx.save();
  ctx.clearRect(0,0,w,h);

  // background grid
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "rgba(255,255,255,.20)";
  ctx.lineWidth = 1;

  const gridLines = 5;
  for(let i=0;i<=gridLines;i++){
    const y = pad + (h-2*pad) * (i/gridLines);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w-pad, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // axes
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, h-pad);
  ctx.lineTo(w-pad, h-pad);
  ctx.stroke();

  // labels
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "12px system-ui, Segoe UI, Arial";
  ctx.fillText(yLabel, pad, 14);

  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.fillText(yMax.toFixed(1), 6, pad+4);
  ctx.fillText(yMin.toFixed(1), 6, h-pad+4);

  ctx.restore();
}

function drawLineSeries(ctx, xScale, yScale, points, strokeStyle){
  const pts = points.filter(p => Number.isFinite(p.y));
  if(pts.length < 2) return;

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  for(let i=0;i<pts.length;i++){
    const x = xScale(pts[i].x);
    const y = yScale(pts[i].y);
    if(i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  }
  ctx.stroke();

  // points
  ctx.fillStyle = strokeStyle;
  for(const p of pts){
    const x = xScale(p.x);
    const y = yScale(p.y);
    ctx.beginPath();
    ctx.arc(x,y,3.2,0,Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

function hashToColor(str){
  // deterministic light-ish color with CSS hsl()
  let h = 0;
  for(let i=0;i<str.length;i++) h = (h*31 + str.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 85% 65%)`;
}

function setLegend(el, items){
  el.innerHTML = "";
  for(const it of items){
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<span class="swatch" style="background:${it.color}"></span>${escapeHtml(it.label)}`;
    el.appendChild(div);
  }
}

function lastNDays(logsAsc, n){
  if(n >= 99999) return logsAsc;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (n-1));
  const cutoffISO = cutoff.toISOString().slice(0,10);
  return logsAsc.filter(l => l.date >= cutoffISO);
}

function indexPoints(logsAsc){
  return logsAsc.map((l,i)=> ({i, date:l.date, log:l}));
}

function drawMultiLine(canvasId, legendId, logsAsc, series, yLabel){
  const c = $(canvasId);
  const legend = $(legendId);
  if(!c) return;
  const ctx = c.getContext("2d");
  const w = c.width, h = c.height;
  const pad = 48;

  const ptsIndex = indexPoints(logsAsc);

  const allValues = [];
  for(const s of series){
    for(const p of ptsIndex){
      const v = s.get(p.log);
      if(Number.isFinite(v)) allValues.push(v);
    }
  }
  const {min:yMin, max:yMax} = niceMinMax(allValues);

  const xMin = 0;
  const xMax = Math.max(1, ptsIndex.length - 1);

  const xScale = scaleLinear(xMin, xMax, pad, w-pad);
  const yScale = scaleLinear(yMin, yMax, h-pad, pad);

  drawAxes(ctx, w, h, pad, yMin, yMax, yLabel);

  // x labels (start/end)
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.font = "12px system-ui, Segoe UI, Arial";
  if(ptsIndex.length){
    ctx.fillText(ptsIndex[0].date, pad, h-14);
    const endText = ptsIndex[ptsIndex.length-1].date;
    const tw = ctx.measureText(endText).width;
    ctx.fillText(endText, w-pad-tw, h-14);
  }
  ctx.restore();

  const legendItems = [];
  for(const s of series){
    const color = hashToColor(s.label);
    const pts = ptsIndex.map(p => ({x:p.i, y:s.get(p.log)}));
    drawLineSeries(ctx, xScale, yScale, pts, color);
    legendItems.push({label:s.label, color});
  }
  if(legend) setLegend(legend, legendItems);
}

function drawBarCounts(canvasId, legendId, logsAsc, groups){
  const c = $(canvasId);
  const legend = $(legendId);
  if(!c) return;
  const ctx = c.getContext("2d");
  const w = c.width, h = c.height;
  const pad = 58;

  const totals = groups.map(g=>{
    let count = 0;
    for(const l of logsAsc) count += g.countFn(l);
    return {label:g.label, count};
  });

  const max = Math.max(1, ...totals.map(t=>t.count));
  ctx.clearRect(0,0,w,h);

  // axes
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, h-pad);
  ctx.lineTo(w-pad, h-pad);
  ctx.stroke();

  // y labels
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "12px system-ui, Segoe UI, Arial";
  ctx.fillText("Count", pad, 14);
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.fillText(String(max), 12, pad+4);
  ctx.fillText("0", 18, h-pad+4);

  const barAreaW = (w - 2*pad);
  const gap = 16;
  const barW = Math.max(22, (barAreaW - gap*(totals.length-1)) / totals.length);

  const x0 = pad;
  const y0 = h - pad;
  const yScale = scaleLinear(0, max, 0, (h - 2*pad));

  const legendItems = [];
  totals.forEach((t, idx)=>{
    const color = hashToColor(t.label);
    const x = x0 + idx*(barW+gap);
    const barH = yScale(t.count);
    const y = y0 - barH;

    // bar
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, y, barW, barH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.strokeRect(x, y, barW, barH);

    // labels
    ctx.fillStyle = "rgba(255,255,255,.90)";
    ctx.font = "12px system-ui, Segoe UI, Arial";
    const ctext = String(t.count);
    const tw = ctx.measureText(ctext).width;
    ctx.fillText(ctext, x + (barW-tw)/2, Math.max(pad+14, y-6));

    ctx.fillStyle = "rgba(255,255,255,.80)";
    ctx.font = "11px system-ui, Segoe UI, Arial";
    const label = t.label;
    const lw = ctx.measureText(label).width;
    ctx.fillText(label, x + (barW-lw)/2, h - pad + 20);

    legendItems.push({label:t.label, color});
  });

  if(legend) setLegend(legend, legendItems);
}

async function refreshCharts(){
  const range = Number($("#chartRange")?.value ?? 30);

  const logsAscAll = sortByDateAsc(await getAllLogs());
  const logsAsc = lastNDays(logsAscAll, range);

  // Sugar
  drawMultiLine(
    "#chartSugar", "#legendSugar",
    logsAsc,
    [
      { label:"Fasting", get:(l)=> l.fasting_blood_sugar },
      { label:"Pre-dinner", get:(l)=> l.pre_dinner_sugar },
      { label:"Post-dinner", get:(l)=> l.post_dinner_sugar },
    ],
    "mmol/L"
  );

  // Weight & fat
  drawMultiLine(
    "#chartWeightFat", "#legendWeightFat",
    logsAsc,
    [
      { label:"Weight (kg)", get:(l)=> l.weight },
      { label:"Fat (%)", get:(l)=> l.fat_percentage },
    ],
    "kg / %"
  );

  // Waist
  drawMultiLine(
    "#chartWaist", "#legendWaist",
    logsAsc,
    [
      { label:"Waist (cm)", get:(l)=> l.waist_size },
    ],
    "cm"
  );

  // Blood pressure
  drawMultiLine(
    "#chartBP", "#legendBP",
    logsAsc,
    [
      { label:"Systolic", get:(l)=> l.blood_pressure_systolic },
      { label:"Diastolic", get:(l)=> l.blood_pressure_diastolic },
    ],
    "mmHg"
  );

  // Grip
  drawMultiLine(
    "#chartGrip", "#legendGrip",
    logsAsc,
    [
      { label:"Grip Left", get:(l)=> l.grip_strength_left },
      { label:"Grip Right", get:(l)=> l.grip_strength_right },
    ],
    "kg"
  );

  // Activity counts (supp/exercise/fasting days)
  drawBarCounts(
    "#chartActivity", "#legendActivity",
    logsAsc,
    [
      { label:"Supplements checked", countFn:(l)=> countTrue(l.supplements) + (l.custom_vitamin_name?.trim() && l.custom_vitamin_taken ? 1 : 0) },
      { label:"Exercises checked", countFn:(l)=> countTrue(l.exercises) },
      { label:"Fasted days", countFn:(l)=> l.fasted ? 1 : 0 },
      { label:"Water fasted days", countFn:(l)=> l.water_fasted ? 1 : 0 },
    ]
  );
}

/* ---------- Offline (service worker) ---------- */

async function registerSW(){
  if(!("serviceWorker" in navigator)) return;
  try{
    const reg = await navigator.serviceWorker.register("service-worker.js");
    // optional update check
    reg.update?.();
  }catch(e){
    console.warn("SW register failed", e);
  }
}

function refreshOfflineBadge(){
  const el = $("#offlineBadge");
  if(!el) return;
  const online = navigator.onLine;
  el.textContent = online ? "Online (but app works offline)" : "Offline (good)";
  el.className = "badge " + (online ? "warn" : "ok");
}

async function refreshCache(){
  if(!("serviceWorker" in navigator)) { alert("Service workers not supported."); return; }
  const reg = await navigator.serviceWorker.getRegistration();
  if(reg?.active){
    reg.active.postMessage({type:"REFRESH_CACHE"});
    alert("Requested cache refresh. If you updated files, reload the page once.");
  }else{
    alert("Service worker not active yet. Reload once, then try again.");
  }
}

/* ---------- Wire-up ---------- */

window.addEventListener("load", async ()=>{
  setupTabs();
  buildDynamicLists();

  // default date
  $("#logDate").value = todayISO();
  await loadDate($("#logDate").value);

  $("#btnLoadToday").addEventListener("click", async ()=> loadDate(todayISO()));
  $("#btnLoadSelected").addEventListener("click", async ()=> loadDate($("#logDate").value || todayISO()));
  $("#btnSave").addEventListener("click", async ()=>{
    await saveCurrent();
    await refreshHistory();
    await refreshCharts();
  });
  $("#btnDeleteThisDay").addEventListener("click", async ()=>{
    await deleteCurrentDay();
    await refreshHistory();
    await refreshCharts();
  });

  $("#historySearch").addEventListener("input", ()=> refreshHistory());
  $("#historyLimit").addEventListener("change", ()=> refreshHistory());
  $("#btnRefreshHistory").addEventListener("click", ()=> refreshHistory());

  $("#btnRefreshCharts").addEventListener("click", ()=> refreshCharts());
  $("#chartRange").addEventListener("change", ()=> refreshCharts());

  $("#btnExportJSON").addEventListener("click", ()=> exportJSON());
  $("#btnExportCSV").addEventListener("click", ()=> exportCSV());
  $("#btnImport").addEventListener("click", ()=> importJSON());

  $("#btnClearAll").addEventListener("click", async ()=>{
    if(!confirm("Clear ALL data on this device?")) return;
    await clearAll();
    await loadDate($("#logDate").value || todayISO());
    await refreshHistory();
    await refreshCharts();
    alert("All data cleared.");
  });

  $("#btnClearRange").addEventListener("click", async ()=>{
    const from = $("#clearFrom").value;
    const to = $("#clearTo").value;
    if(!from || !to){ alert("Pick both From and To dates."); return; }
    if(from > to){ alert("From date must be before To date."); return; }
    if(!confirm(`Clear logs from ${from} to ${to} (inclusive)?`)) return;
    await clearRange(from, to);
    await loadDate($("#logDate").value || todayISO());
    await refreshHistory();
    await refreshCharts();
    alert("Range cleared.");
  });

  $("#btnReinstallSW").addEventListener("click", ()=> refreshCache());

  window.addEventListener("online", refreshOfflineBadge);
  window.addEventListener("offline", refreshOfflineBadge);

  await registerSW();
  refreshOfflineBadge();

  // initial refresh for background tabs
  await refreshHistory();
  await refreshCharts();
});
