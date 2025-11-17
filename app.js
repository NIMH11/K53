const JSON_PATH = "rules_questions.json";
const LS_KEY = "k53_reports_v2";
const LS_MARKED = "k53_marked_v1";


const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const state = { data: [], showImages: true, showExplanations: false, search: "", markedIds: readMarked() };

async function loadInitial(){
  try{
    const res = await fetch(JSON_PATH);
    if(!res.ok) throw new Error(res.status + " " + res.statusText);
    const data = await res.json();
    state.data = normalize(data);
    render();
  }catch(err){
    showError("Could not load rules_questions.json: " + err.message + ". Run with `python server.py` and keep JSON next to index.html.");
  }
}

function normalize(arr){
  const out = [];
  for(const q of arr){
    const id = String(q.id ?? "").trim();
    const text = String(q.text ?? "").trim();
    const options = Array.isArray(q.options) ? q.options.map(o=>String(o)) : [];
    const correctIndex = Number.isInteger(q.correctIndex) ? q.correctIndex : -1;
    if(id && text && options.length && correctIndex >= 0 && correctIndex < options.length){
      out.push({ id, category: q.category || "", text, options, correctIndex, explanation: q.explanation || "", image: q.image || "" });
    }
  }
  return out;
}

function showError(msg){
  const el = $("#error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function render() {
  const app = $("#app");
  const q = state.search.toLowerCase().trim();
  const items = state.data.filter(it => (it.id + " " + it.text + " " + (it.category||"")).toLowerCase().includes(q));

  $("#count").textContent = items.length ? `${items.length} shown of ${state.data.length}` : (state.data.length ? `0 shown of ${state.data.length}` : "");

  app.innerHTML = items.map(item => cardHtml(item)).join("") || "<p>No results.</p>";

  $$(".toggle-exp").forEach(btn => btn.addEventListener("click", e => {
    const card = e.target.closest(".card");
    const expl = $(".expl", card);
    expl.classList.toggle("show");
  }));

  $$(".report").forEach(btn => btn.addEventListener("click", e => {
    const card = e.target.closest(".card");
    const id = card.dataset.id;
    const ansIdx = Number(card.dataset.correctIndex);
    const item = state.data.find(x => x.id === id);
    openReportDialog(item, ansIdx);
  }));
$$(".mark").forEach(btn => btn.addEventListener("click", e => {
  const card = e.target.closest(".card");
  if(!card) return;
  const id = card.dataset.id;
  if(!id) return;
  if(state.markedIds.has(id)){
    state.markedIds.delete(id);
  } else {
    state.markedIds.add(id);
  }
  saveMarked(state.markedIds);
  render();
}));

}


function cardHtml(item) {
  const correctIdx = Number(item.correctIndex);

  const opts = (item.options || []).map((opt, idx) => {
    const isCorrect = idx === correctIdx;
    const label = String.fromCharCode(65 + idx);
    return `
      <div class="opt ${isCorrect ? "correct" : ""}">
        ${isCorrect ? '<span class="badge">✓</span>' : ""}
        <strong>${label}.</strong> ${escapeHtml(opt)}
      </div>
    `;
  }).join("");

  const img = item.image && state.showImages
    ? `<img class="qimg" src="${escapeAttr(item.image)}" alt="">`
    : "";

  const expl = item.explanation
    ? `<div class="expl ${state.showExplanations ? "show" : ""}">${escapeHtml(item.explanation)}</div>`
    : "";

  const isMarked = state.markedIds.has(item.id);
  const markLabel = isMarked ? "Undo mark" : "Mark reviewed";
  const tick = isMarked ? "✓ " : "";

  return `
    <article class="card ${isMarked ? "marked" : ""}"
             data-id="${escapeAttr(item.id)}"
             data-category="${escapeAttr(item.category || "")}"
             data-correct-index="${correctIdx}">
      <header>
        <div class="meta">
          <span>${tick}#${escapeHtml(item.id)}</span>
          <span>${escapeHtml(item.category || "Uncategorised")}</span>
        </div>
        <div class="qtext">${escapeHtml(item.text)}</div>
      </header>
      <div class="options">${opts}</div>${img}${expl}
      <div class="actions">
        <button class="toggle-exp">Toggle explanation</button>
        <button class="report">Report</button>
        <button class="mark">${markLabel}</button>
      </div>
    </article>
  `;
}

function openReportDialog(item, ansIdx){
  const dlg = $("#reportDialog");
  const meta = $("#reportQuestionMeta");
  const reasonSel = $("#reportReason");
  const details = $("#reportDetails");
  const radios = $("#answerRadios");

  meta.textContent = `ID: ${item.id} • Marked correct: ${(item.options||[])[ansIdx]||""} (${String.fromCharCode(65+ansIdx)})`;

  // Build A/B/C/D radios dynamically
  radios.innerHTML = (item.options||[]).map((opt, i)=>{
    const letter = String.fromCharCode(65+i);
    const id = `sel_${i}`;
    return `<label class="radio-pill" for="${id}"><input type="radio" name="selcorrect" id="${id}" value="${i}"/> ${letter}</label>`;
  }).join("");

  // Default selection: first option different from marked, else first
  const inputs = $$("input[name='selcorrect']", radios);
  let defaultIdx = 0;
  if(inputs.length>1 && ansIdx === 0) defaultIdx = 1;
  inputs[defaultIdx]?.setAttribute("checked","checked");

  $("#reportForm").onsubmit = async (e) => {
    e.preventDefault();
    const sel = $("input[name='selcorrect']:checked", dlg);
    if(!sel){ alert("Select the correct answer letter."); return; }
    const selIdx = Number(sel.value);

    const report = {
      id: item.id,
      question: item.text,
      marked_correct_index: ansIdx,
      marked_correct_text: (item.options||[])[ansIdx] || "",
      selected_correct_index: selIdx,
      selected_correct_letter: String.fromCharCode(65+selIdx),
      selected_correct_text: (item.options||[])[selIdx] || "",
      reason: reasonSel.value,
      details: details.value || "",
      timestamp: Date.now()
    };
    addReport(report);
    try{
      await fetch('/report', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(report)});
    }catch(e){
      console.warn('Server save failed:', e);
    }
    alert("Saved. Report written locally and to the server's reports/ folder.");
    dlg.close();
  };

  dlg.showModal();
}


// Marked questions store
function readMarked(){
  try{
    const raw = localStorage.getItem(LS_MARKED);
    if(!raw) return new Set();
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr)) return new Set();
    return new Set(arr);
  }catch{
    return new Set();
  }
}
function saveMarked(idsSet){
  localStorage.setItem(LS_MARKED, JSON.stringify(Array.from(idsSet)));
}

// Reports store (browser-local backup)
function readReports(){ try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } }
function saveReports(rows){ localStorage.setItem(LS_KEY, JSON.stringify(rows)); }
function addReport(rep){ const rows = readReports(); rows.push(rep); saveReports(rows); }

function escapeHtml(s){ return (s ?? "").toString().replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function escapeAttr(s){ return (s ?? "").toString().replaceAll('"',"&quot;").replaceAll("<","&lt;"); }

window.addEventListener("DOMContentLoaded", () => {
  $("#search").addEventListener("input", (e) => { state.search = e.target.value; render(); });
  $("#showImages").addEventListener("change", (e) => { state.showImages = e.target.checked; render(); });
  $("#showExplanations").addEventListener("change", (e) => { state.showExplanations = e.target.checked; render(); });
  loadInitial();
});
