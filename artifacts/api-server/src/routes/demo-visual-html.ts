export const DEMO_VISUAL_HTML = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>TancMark — Görsel Test Laboratuvarı (V24.1)</title>
<style>
  :root { --bg:#0b1020; --panel:#141a2e; --ink:#e6e9f2; --muted:#9aa3b2; --line:#1f2742; --ok:#22c55e; --warn:#f59e0b; --bad:#ef4444; --accent:#60a5fa; }
  *{box-sizing:border-box} body{margin:0;font:14px/1.55 system-ui,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink)}
  .wrap{max-width:1200px;margin:0 auto;padding:24px}
  h1{font-size:22px;margin:0 0 2px;display:flex;align-items:center;gap:10px}
  h1 .badge{font-size:11px;background:rgba(96,165,250,.18);color:var(--accent);padding:2px 7px;border-radius:999px;font-weight:600;letter-spacing:.5px}
  .sub{color:var(--muted);margin:0 0 16px;font-size:13px}
  .grid{display:grid;grid-template-columns:380px 1fr;gap:16px}
  @media (max-width:900px){.grid{grid-template-columns:1fr}}
  .card{background:var(--panel);border-radius:10px;padding:14px 16px;border:1px solid var(--line);margin-bottom:14px}
  .card h3{margin:0 0 10px;font-size:14px;display:flex;align-items:center;gap:8px}
  .card h3 .step{display:inline-block;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#0b1020;text-align:center;line-height:22px;font-weight:800;font-size:12px}
  label{display:block;font-weight:600;margin:8px 0 4px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
  input[type=text],input[type=password]{width:100%;padding:9px 11px;border-radius:7px;border:1px solid #2a3354;background:#0e1428;color:var(--ink);font:inherit}
  button{background:var(--accent);color:#0b1020;border:0;padding:10px 18px;border-radius:7px;font-weight:700;cursor:pointer;font:inherit}
  button:disabled{opacity:.5;cursor:not-allowed}
  button.ghost{background:#1f2742;color:var(--ink)}
  .drop{border:2px dashed #2a3354;border-radius:9px;padding:18px;text-align:center;cursor:pointer;transition:.15s;background:#0e1428}
  .drop.hot{border-color:var(--accent);background:rgba(96,165,250,.08)}
  .drop p{margin:6px 0;color:var(--muted);font-size:13px}
  #preview{max-width:100%;max-height:220px;margin-top:10px;border-radius:6px;display:none;background:#0e1428}
  .scns{display:flex;flex-direction:column;gap:6px;margin-top:6px}
  .scns label{display:flex;gap:9px;align-items:center;background:#0e1428;padding:8px 10px;border-radius:6px;border:1px solid var(--line);cursor:pointer;font-weight:500;margin:0;text-transform:none;letter-spacing:0;color:var(--ink);font-size:13px}
  .scns label.dis{opacity:.5;cursor:not-allowed}
  .scns input{margin:0;accent-color:var(--accent)}
  .progress{height:6px;background:#0e1428;border-radius:99px;overflow:hidden;margin:10px 0}
  .progress > div{height:100%;background:linear-gradient(90deg,var(--accent),#a78bfa);width:0%;transition:width .3s}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{padding:9px 8px;text-align:left;border-bottom:1px solid var(--line);vertical-align:middle}
  th{color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
  .tag{display:inline-block;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;white-space:nowrap}
  .tag.ok{background:rgba(34,197,94,.18);color:var(--ok)}
  .tag.warn{background:rgba(245,158,11,.18);color:var(--warn)}
  .tag.bad{background:rgba(239,68,68,.18);color:var(--bad)}
  .tag.mute{background:#1f2742;color:var(--muted)}
  .status-msg{font-size:12px;color:var(--muted);margin-left:8px}
  .help{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.5}
  .kbd{font-family:ui-monospace,Menlo,Consolas,monospace;background:#0e1428;padding:1px 6px;border-radius:4px;font-size:12px;border:1px solid var(--line)}
  details > summary{cursor:pointer;color:var(--accent);font-size:12px;font-weight:600}
  pre{background:#0e1428;padding:10px;border-radius:6px;font-size:11px;overflow:auto;max-height:260px;margin:6px 0 0}
  .stat-row{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:var(--muted)}
  .stat-row b{color:var(--ink);font-weight:600}
  .empty{color:var(--muted);text-align:center;padding:24px;font-size:13px}
  .err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fecaca;padding:8px 10px;border-radius:6px;font-size:12px;margin-top:8px}
</style>
</head>
<body>
<div class="wrap">
  <h1>TancMark Görsel Test Laboratuvarı <span class="badge">V24.1 Sarsılmaz Zırh</span></h1>
  <p class="sub">Kendi fotoğrafını yükle → seçtiğin saldırılar altında mühür çözülebiliyor mu canlı gör. Aynı motor, gece arena testindeki %86 dirence sahip.</p>

  <div class="grid">
    <div>
      <div class="card">
        <h3><span class="step">1</span> Yetki</h3>
        <label>Admin Token</label>
        <input id="adminToken" type="password" placeholder="ADMIN_TOKEN değeri" autocomplete="off" />
        <div class="help">Sandbox'taki <span class="kbd">ADMIN_TOKEN</span> secret değeri. Yapıştır.</div>
      </div>

      <div class="card">
        <h3><span class="step">2</span> Fotoğraf</h3>
        <div id="drop" class="drop">
          <div style="font-size:28px">📷</div>
          <p><b>Tıkla veya bırak</b> — JPG/PNG, en çok 16 MB</p>
          <p style="font-size:11px">Motor 800×600 alan kırpıp mührü gömecek</p>
        </div>
        <input id="fileInput" type="file" accept="image/jpeg,image/png" style="display:none" />
        <img id="preview" alt="önizleme" />
        <div id="fileMeta" class="help"></div>
      </div>

      <div class="card">
        <h3><span class="step">3</span> Saldırı Senaryoları</h3>
        <div id="scns" class="scns"><div class="help">Yükleniyor…</div></div>
        <div class="help" style="margin-top:8px">Senaryo başına en fazla <b id="timeoutLbl">180s</b>. Sıralı çalışır (sandbox CPU dostu).</div>
      </div>

      <button id="runBtn" disabled style="width:100%">🛡️ Mühürle ve Test Et</button>
      <div id="runStatus" class="status-msg" style="display:block;margin-top:8px"></div>
    </div>

    <div>
      <div class="card">
        <h3>📊 Sonuçlar <span id="resultSummary" class="status-msg"></span></h3>
        <div class="progress"><div id="progressBar"></div></div>
        <table>
          <thead>
            <tr><th>Senaryo</th><th>Sonuç</th><th>Güven</th><th>Sinyal (R1)</th><th>Bit gücü</th><th>Süre</th><th>Detay</th></tr>
          </thead>
          <tbody id="resultsBody">
            <tr><td colspan="7" class="empty">Henüz test yok. Sol panelden başla.</td></tr>
          </tbody>
        </table>
        <div class="help" style="margin-top:10px">
          <b>Açıklamalar:</b>
          <span class="tag ok">✓ Mühür bulundu</span> Kriptografik kesinlik (PQC + CRC + ID, conf≥0.85).
          <span class="tag warn">≈ Ön İhtimal</span> Sinyal var ama eşik altı.
          <span class="tag bad">✗ Bulunamadı</span> Mühür çözülemedi.
        </div>
      </div>

      <div class="card">
        <h3>ℹ️ Nasıl Çalışır</h3>
        <ol style="margin:6px 0 0 18px;padding:0;line-height:1.7;font-size:13px">
          <li>Foto sunucuya yüklenir, geçici diske yazılır.</li>
          <li>Her senaryo için motor: <b>(a)</b> fotoyu altlık alıp üzerine 3 katmanlı mühür gömer, <b>(b)</b> seçili saldırıyı uygular (döndürme + JPEG + opsiyonel bulanıklık), <b>(c)</b> mührü çözmeye çalışır.</li>
          <li>Sonuç: <b>Mühür bulundu</b> (PQC imza doğrulandı) ya da <b>Bulunamadı</b>.</li>
          <li>Senaryo başına çalışma 5–180 saniye sürebilir.</li>
        </ol>
      </div>
    </div>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
let pickedFile = null;
let scenarios = [];
let activeJobId = null;
let pollTimer = null;

function setStatus(msg, kind) {
  const el = $("runStatus");
  el.textContent = msg;
  el.style.color = kind === "ok" ? "var(--ok)" : kind === "bad" ? "var(--bad)" : kind === "warn" ? "var(--warn)" : "var(--muted)";
}

async function loadScenarios() {
  try {
    const r = await fetch("/api/aegis/visual-lab/scenarios");
    if (!r.ok) throw new Error("HTTP " + r.status);
    scenarios = await r.json();
    const def = new Set(["baseline_q100","rot13.7_q75","rot5.05_q92","rot90_q92"]);
    $("scns").innerHTML = scenarios.map(s =>
      '<label><input type="checkbox" class="scn" value="'+esc(s.name)+'"'+(def.has(s.name)?" checked":"")+' />'
      + '<span>'+esc(s.label)+'</span></label>'
    ).join("");
  } catch (e) {
    $("scns").innerHTML = '<div class="err">Senaryolar yüklenemedi: '+esc(e.message)+'</div>';
  }
}

function showPreview(file) {
  pickedFile = file;
  $("fileMeta").innerHTML = '<b>'+esc(file.name)+'</b> · '+(file.size/1024).toFixed(0)+' KB · '+esc(file.type);
  const url = URL.createObjectURL(file);
  $("preview").src = url;
  $("preview").style.display = "block";
  updateRunBtn();
}

function updateRunBtn() {
  const tok = $("adminToken").value.trim();
  const any = document.querySelectorAll(".scn:checked").length > 0;
  $("runBtn").disabled = !(pickedFile && tok && any);
}

$("drop").addEventListener("click", () => $("fileInput").click());
$("drop").addEventListener("dragover", (e) => { e.preventDefault(); $("drop").classList.add("hot"); });
$("drop").addEventListener("dragleave", () => $("drop").classList.remove("hot"));
$("drop").addEventListener("drop", (e) => {
  e.preventDefault(); $("drop").classList.remove("hot");
  if (e.dataTransfer.files[0]) showPreview(e.dataTransfer.files[0]);
});
$("fileInput").addEventListener("change", (e) => { if (e.target.files[0]) showPreview(e.target.files[0]); });
$("adminToken").addEventListener("input", updateRunBtn);
document.addEventListener("change", (e) => { if (e.target.classList?.contains("scn")) updateRunBtn(); });

async function startJob() {
  const tok = $("adminToken").value.trim();
  if (!tok || !pickedFile) return;
  const sel = Array.from(document.querySelectorAll(".scn:checked")).map(c => c.value);
  if (sel.length === 0) return;
  $("runBtn").disabled = true;
  setStatus("Yükleniyor ve iş başlatılıyor…", "muted");
  const fd = new FormData();
  fd.append("image", pickedFile);
  fd.append("scenarios", sel.join(","));
  try {
    const r = await fetch("/api/aegis/visual-lab/jobs", {
      method: "POST", headers: { "x-admin-token": tok }, body: fd,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
    activeJobId = j.jobId;
    initResultsTable(j.scenarios);
    setStatus("✓ İş başlatıldı: " + j.scenarios.length + " senaryo. Sonuçlar geliyor…", "ok");
    pollJob();
  } catch (e) {
    setStatus("Hata: " + e.message, "bad");
    $("runBtn").disabled = false;
  }
}

function initResultsTable(scns) {
  $("resultsBody").innerHTML = scns.map(s =>
    '<tr data-name="'+esc(s.name)+'">'
    + '<td>'+esc(s.label)+'</td>'
    + '<td><span class="tag mute">sırada</span></td>'
    + '<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>'
    + '</tr>'
  ).join("");
  $("progressBar").style.width = "0%";
  $("resultSummary").textContent = "";
}

function tagFor(s) {
  if (s.status === "queued") return '<span class="tag mute">sırada</span>';
  if (s.status === "running") return '<span class="tag warn">çalışıyor…</span>';
  if (s.error) return '<span class="tag bad" title="'+esc(s.error)+'">hata</span>';
  if (s.vault === true) return '<span class="tag ok">✓ Mühür bulundu</span>';
  if (s.vault === false && (s.dataR1 ?? 0) >= 0.3) return '<span class="tag warn">≈ Ön İhtimal</span>';
  if (s.vault === false) return '<span class="tag bad">✗ Bulunamadı</span>';
  return '<span class="tag mute">—</span>';
}

function renderResults(job) {
  let vault = 0, done = 0;
  for (const s of job.scenarios) {
    const tr = document.querySelector('tr[data-name="'+CSS.escape(s.name)+'"]');
    if (!tr) continue;
    const conf = s.conf != null ? (s.conf*100).toFixed(1)+"%" : "—";
    const r1   = s.dataR1 != null ? s.dataR1.toFixed(3) : "—";
    const sg   = s.strong || "—";
    const wall = s.wallSec != null ? s.wallSec.toFixed(1)+"s" : "—";
    const det  = s.status === "done" || s.status === "error"
      ? '<details><summary>log</summary><pre id="log-'+esc(s.name)+'">yükle…</pre></details>'
      : "—";
    tr.innerHTML = '<td>'+esc(s.label)+'</td>'
      + '<td>'+tagFor(s)+'</td>'
      + '<td>'+conf+'</td><td>'+r1+'</td><td>'+sg+'</td><td>'+wall+'</td><td>'+det+'</td>';
    if (s.status === "done" || s.status === "error") done++;
    if (s.vault === true) vault++;
  }
  const pct = job.scenarios.length ? Math.round(done / job.scenarios.length * 100) : 0;
  $("progressBar").style.width = pct + "%";
  $("resultSummary").innerHTML = done + "/" + job.scenarios.length + " bitti · <b style=\\"color:var(--ok)\\">" + vault + " mühür bulundu</b>";
}

async function pollJob() {
  if (!activeJobId) return;
  const tok = $("adminToken").value.trim();
  try {
    const r = await fetch("/api/aegis/visual-lab/jobs/" + activeJobId, { headers: { "x-admin-token": tok } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const job = await r.json();
    renderResults(job);
    if (job.status === "done" || job.status === "error") {
      const vault = job.scenarios.filter(s => s.vault === true).length;
      const total = job.scenarios.length;
      const pct = total ? Math.round(vault/total*100) : 0;
      setStatus("✓ Tamamlandı · " + vault + "/" + total + " mühür bulundu (%" + pct + ") · toplam " + job.totalSec.toFixed(1) + "s", vault===total?"ok":vault>0?"warn":"bad");
      $("runBtn").disabled = false;
      activeJobId = null;
      return;
    }
    pollTimer = setTimeout(pollJob, 2500);
  } catch (e) {
    setStatus("Polling hata: " + e.message + " — 5s sonra tekrar", "warn");
    pollTimer = setTimeout(pollJob, 5000);
  }
}

document.addEventListener("click", async (e) => {
  if (e.target.tagName === "SUMMARY") {
    const tr = e.target.closest("tr"); if (!tr) return;
    const name = tr.dataset.name;
    const pre = document.getElementById("log-" + name);
    if (!pre || pre.dataset.loaded === "1" || !activeJobIdOrLast()) return;
    pre.dataset.loaded = "1";
    const tok = $("adminToken").value.trim();
    try {
      const r = await fetch("/api/aegis/visual-lab/jobs/" + activeJobIdOrLast() + "/stdout/" + encodeURIComponent(name), { headers: { "x-admin-token": tok } });
      pre.textContent = await r.text();
    } catch (err) { pre.textContent = "log alınamadı: " + err.message; }
  }
});

let lastJobId = null;
function activeJobIdOrLast() { return activeJobId || lastJobId; }
const _origPoll = pollJob;
// Bitince son jobId'yi sakla
const _origRender = renderResults;

$("runBtn").addEventListener("click", () => { lastJobId = null; startJob().then(()=>{ if(activeJobId) lastJobId = activeJobId; }); });

loadScenarios();
</script>
</body>
</html>`;
