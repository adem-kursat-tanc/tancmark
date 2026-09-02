export const DEMO_HTML = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TancMark · Demo</title>
<style>
  :root { color-scheme: dark; --bg:#0b1020; --panel:#141a2e; --border:#243049; --text:#e6ecff; --muted:#8a96b8; --accent:#6ea8ff; --good:#4ade80; --warn:#fbbf24; --bad:#f87171; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height:1.5; }
  header { padding: 24px 32px; border-bottom: 1px solid var(--border); }
  header h1 { margin:0; font-size: 22px; letter-spacing: .3px; }
  header p { margin: 6px 0 0; color: var(--muted); font-size: 14px; }
  main { display:grid; grid-template-columns: repeat(auto-fit, minmax(440px, 1fr)); gap: 20px; padding: 24px 32px; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
  .card h2 { margin: 0 0 4px; font-size: 16px; }
  .card .desc { color: var(--muted); font-size: 13px; margin-bottom: 12px; }
  label { display:block; font-size: 12px; color: var(--muted); margin: 10px 0 4px; }
  textarea, input[type=text], input[type=number] { width:100%; background:#0b1126; color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font: 13px ui-monospace, monospace; }
  textarea { min-height: 96px; resize: vertical; }
  button { background: var(--accent); color:#0b1020; border: none; padding: 8px 14px; font-weight: 600; border-radius: 8px; cursor: pointer; margin-top: 10px; }
  button.secondary { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
  .row { display:flex; gap:8px; flex-wrap: wrap; }
  .out { margin-top: 10px; padding: 10px; background:#0b1126; border:1px dashed var(--border); border-radius: 8px; font: 12px ui-monospace, monospace; white-space: pre-wrap; word-break: break-all; min-height: 28px; }
  .pill { display:inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight:600; }
  .pill.good { background: rgba(74,222,128,.15); color: var(--good); }
  .pill.warn { background: rgba(251,191,36,.15); color: var(--warn); }
  .pill.bad { background: rgba(248,113,113,.15); color: var(--bad); }
  .kv { display:grid; grid-template-columns: max-content 1fr; gap: 4px 12px; font-size: 12px; color: var(--muted); }
  .kv b { color: var(--text); font-weight: 600; }
  footer { padding: 16px 32px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--border); }
  code { color: var(--accent); }
</style>
</head>
<body>
<header>
  <h1>TancMark Demo</h1>
  <p>Hibrit görünmez filigran (homoglyph + zero-width) ve gizlilik için gürültü enjeksiyonu. <code>POST /api/aegis/*</code></p>
</header>

<main>
  <section class="card">
    <h2>1 · Filigranla (Fingerprint)</h2>
    <div class="desc">Bir metni, kullanıcı kimliğine bağlı görünmez bir imzayla işaretle.</div>
    <label>Metin</label>
    <textarea id="fp-text">Hasta tahlil sonuçlarına göre kreatinin değeri normal aralıkta seyretmektedir.</textarea>
    <label>Kullanıcı / Müşteri ID</label>
    <input id="fp-user" type="text" value="customer_42" />
    <div class="row">
      <button onclick="doFingerprint()">Filigranla</button>
      <button class="secondary" onclick="copyTagged()">Kopyala</button>
    </div>
    <label>Filigranlı çıktı</label>
    <div id="fp-out" class="out"></div>
    <div id="fp-meta" class="kv"></div>
  </section>

  <section class="card">
    <h2>2 · Sızanı Bul (Identify)</h2>
    <div class="desc">Sızdırılmış bir metni adaylar listesiyle eşleştir.</div>
    <label>Şüpheli metin</label>
    <textarea id="id-text" placeholder="Filigranlı metni buraya yapıştırın..."></textarea>
    <label>Aday ID'ler (virgülle ayır)</label>
    <input id="id-cands" type="text" value="customer_1, customer_42, customer_99, partner_x" />
    <button onclick="doIdentify()">Tespit Et</button>
    <label>Sonuç</label>
    <div id="id-out" class="out"></div>
  </section>

  <section class="card">
    <h2>3 · Tespit (Detect)</h2>
    <div class="desc">Bir metnin TancMark ile korunup korunmadığını anla.</div>
    <label>Metin</label>
    <textarea id="dt-text"></textarea>
    <button onclick="doDetect()">Tara</button>
    <div id="dt-out" class="out"></div>
  </section>

  <section class="card">
    <h2>4 · Saldırı Simülasyonu</h2>
    <div class="desc">Hırsızın tipik temizleme saldırılarını simüle et — filigran hayatta kalıyor mu?</div>
    <label>Filigranlı metin</label>
    <textarea id="atk-text" placeholder="Filigranlı metni buraya yapıştırın..."></textarea>
    <div class="row">
      <button onclick="attackZW()">Sadece zero-width sil</button>
      <button onclick="attackHomo()">Sadece homoglyph normalize et</button>
      <button onclick="attackBoth()">İkisini de sil</button>
    </div>
    <label>Saldırı sonrası</label>
    <div id="atk-out" class="out"></div>
    <label>Saldırı sonrası kim tespit edilebiliyor?</label>
    <div id="atk-id" class="out"></div>
  </section>

  <section class="card">
    <h2>5 · Sayısal Gürültü (Privacy / Robustness)</h2>
    <div class="desc">Dağılımsal kayma — dış katmana özel veri için.</div>
    <label>Değer</label>
    <input id="nn-val" type="number" value="98.6" step="0.01" />
    <label>Bias %</label>
    <input id="nn-bias" type="number" value="0.2" step="0.05" />
    <label>Seed (deterministik için, opsiyonel)</label>
    <input id="nn-seed" type="text" placeholder="örn. patient_123" />
    <button onclick="doNoiseN()">Gürültü Ekle</button>
    <div id="nn-out" class="out"></div>
  </section>

  <section class="card">
    <h2>6 · Metin Gürültüsü</h2>
    <div class="desc">Görünmez karakter gürültüsü — tarayıcı için görünmez, scraper için kirli veri.</div>
    <label>Metin</label>
    <textarea id="nt-text">Bu metin korunmalıdır.</textarea>
    <label>Yoğunluk (0-1)</label>
    <input id="nt-density" type="number" value="0.05" step="0.01" min="0" max="1" />
    <button onclick="doNoiseT()">Gürültü Ekle</button>
    <div id="nt-out" class="out"></div>
  </section>
</main>

<footer>
  TancMark · core · v0.1.0
</footer>

<script>
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
const api = (path, body) => fetch('/api/aegis' + path, {
  method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
}).then(r => r.json());

let lastTagged = '';

async function doFingerprint() {
  const text = document.getElementById('fp-text').value;
  const userId = document.getElementById('fp-user').value;
  const r = await api('/fingerprint', { text, userId });
  document.getElementById('fp-out').textContent = r.tagged;
  document.getElementById('fp-meta').innerHTML =
    '<b>Orijinal uzunluk</b><span>' + r.originalLength + ' karakter</span>' +
    '<b>Filigranlı uzunluk</b><span>' + r.taggedLength + ' karakter</span>' +
    '<b>Görsel fark</b><span>İnsan gözüyle ayırt edilemez</span>';
  lastTagged = r.tagged;
  document.getElementById('id-text').value = r.tagged;
  document.getElementById('dt-text').value = r.tagged;
  document.getElementById('atk-text').value = r.tagged;
}

function copyTagged() { if (lastTagged) navigator.clipboard.writeText(lastTagged); }

async function doIdentify() {
  const text = document.getElementById('id-text').value;
  const candidates = document.getElementById('id-cands').value.split(',').map(s => s.trim()).filter(Boolean);
  const r = await api('/identify', { text, candidates });
  renderIdentify('id-out', r);
}

function renderIdentify(elId, r) {
  const top = r.userId
    ? '<span class="pill good">EŞLEŞTİ: ' + esc(r.userId) + '</span> güven: <b>' + (r.confidence*100).toFixed(1) + '%</b>'
    : '<span class="pill warn">eşik altı</span> en yüksek aday: <b>' + esc(r.ranked[0]?.userId ?? '-') + '</b> · ' + ((r.ranked[0]?.confidence ?? 0)*100).toFixed(1) + '%';
  const channels = Object.entries(r.channels).map(([k,v]) => esc(k) + ': ' + (v*100).toFixed(1) + '%').join('  ·  ') || '(kanal yok)';
  const ranked = r.ranked.map(x => '  ' + esc(x.userId).padEnd(20) + (x.confidence*100).toFixed(1) + '%').join('\\n');
  document.getElementById(elId).innerHTML = top + '\\n\\nKanallar: ' + channels + '\\n\\nSıralama:\\n' + ranked;
}

async function doDetect() {
  const text = document.getElementById('dt-text').value;
  const r = await api('/detect', { text });
  const pill = r.isWatermarked
    ? '<span class="pill good">KORUMALI</span>'
    : '<span class="pill bad">korumasız / iz yok</span>';
  document.getElementById('dt-out').innerHTML = pill +
    '\\n\\nHomoglyph karakter: ' + r.signals.homoglyphCount +
    '\\nZero-width karakter: ' + r.signals.zeroWidthCount +
    '\\nToplam karakter: ' + r.signals.totalChars +
    '\\nHomoglyph oranı: ' + (r.signals.homoglyphRatio*100).toFixed(2) + '%';
}

const CYR_TO_LAT = {'\\u0430':'a','\\u0435':'e','\\u043E':'o','\\u0440':'p','\\u0441':'c','\\u0443':'y','\\u0445':'x','\\u0410':'A','\\u0412':'B','\\u0421':'C','\\u0415':'E','\\u041D':'H','\\u041A':'K','\\u041C':'M','\\u041E':'O','\\u0420':'P','\\u0422':'T','\\u0425':'X','\\u0423':'Y'};
function stripZW(s) { return s.replace(/[\\u200B\\u200C\\u200D\\u2060\\uFEFF]/g, ''); }
function normalizeHomo(s) { let o=''; for (const ch of s) o += CYR_TO_LAT[ch] ?? ch; return o; }

async function strip(text, mode) {
  if (mode === 'zw') return stripZW(text);
  if (mode === 'homo') return normalizeHomo(text);
  return normalizeHomo(stripZW(text));
}

async function runAttack(mode) {
  const text = document.getElementById('atk-text').value;
  const after = await strip(text, mode);
  document.getElementById('atk-out').textContent = after;
  const candidates = document.getElementById('id-cands').value.split(',').map(s=>s.trim()).filter(Boolean);
  const r = await api('/identify', { text: after, candidates });
  renderIdentify('atk-id', r);
}
function attackZW(){ runAttack('zw'); }
function attackHomo(){ runAttack('homo'); }
function attackBoth(){ runAttack('both'); }

async function doNoiseN() {
  const value = parseFloat(document.getElementById('nn-val').value);
  const biasPercent = parseFloat(document.getElementById('nn-bias').value);
  const seed = document.getElementById('nn-seed').value || undefined;
  const r = await api('/noise/numeric', { value, biasPercent, seed });
  document.getElementById('nn-out').textContent =
    'Orijinal:  ' + r.original + '\\nGürültülü: ' + r.noisy + '\\nFark:      ' + ((r.noisy - r.original).toFixed(6));
}

async function doNoiseT() {
  const text = document.getElementById('nt-text').value;
  const density = parseFloat(document.getElementById('nt-density').value);
  const r = await api('/noise/text', { text, density });
  document.getElementById('nt-out').textContent = r.noisy + '\\n\\n(uzunluk: ' + r.noisy.length + ' karakter)';
}

doFingerprint();
</script>
</body>
</html>`;
