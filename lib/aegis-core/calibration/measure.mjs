// AEGIS Faz 4 Kalibrasyon — Ana Ölçüm Scripti
// Çalıştırma: cd lib/aegis-core && node calibration/measure.mjs
//
// Bölüm 1 (OQ-B): Model load timing + memory.
// Bölüm 2: Korpus istatistiği (sanity).
// Bölüm 3a: Tekli operatör Δemb dağılımı (cosine distance + L2).
// Bölüm 3b: Kova hedefleme (1/2/3/4 bit) + coverage.
// Bölüm 4: Rapor markdown'unu perturbation_budget_v1.report.md'ye yazar.

import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { CORPUS_TR_V1, corpusStats } from "./corpus_tr_v1.mjs";
import { PERTURBATIONS, generateVariants } from "./perturbations.mjs";

const REPORT_PATH = new URL("./perturbation_budget_v1.report.md", import.meta.url).pathname;

function bytesToMB(b) { return (b / 1e6).toFixed(1); }
function fmt(n, d = 4) { return Number.isFinite(n) ? n.toFixed(d) : String(n); }

function quantiles(arr, qs) {
  const a = [...arr].sort((x, y) => x - y);
  const out = {};
  for (const q of qs) {
    const idx = Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * q)));
    out[q] = a[idx];
  }
  return out;
}

function meanStd(arr) {
  if (!arr.length) return { mean: 0, std: 0 };
  const m = arr.reduce((s, x) => s + x, 0) / arr.length;
  const v = arr.reduce((s, x) => s + (x - m) * (x - m), 0) / arr.length;
  return { mean: m, std: Math.sqrt(v) };
}

function l2dist(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

function cosineDist(a, b) {
  // a, b normalize edildi (pipeline normalize:true). 1 - dot.
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return 1 - dot;
}

// Sentence-specific deterministic projection direction (unit vector, dim=768).
// Seed: SHA-256(sentence) → 64 bytes → seed for xorshift; 768 floats → normalize.
function projectionDirection(sentence, dim) {
  const h = createHash("sha256").update(sentence).digest();
  // expand: ardışık SHA-256 zinciri ile 768*4 byte üret
  const need = dim * 4;
  const bufs = [h];
  let last = h;
  while (bufs.reduce((s, b) => s + b.length, 0) < need) {
    last = createHash("sha256").update(last).digest();
    bufs.push(last);
  }
  const buf = Buffer.concat(bufs).subarray(0, need);
  const v = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    // 32-bit unsigned int → [-1, 1)
    const u = buf.readUInt32BE(i * 4);
    v[i] = (u / 0xffffffff) * 2 - 1;
  }
  // normalize
  let n = 0;
  for (let i = 0; i < dim; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < dim; i++) v[i] /= n;
  return v;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// ---------------------------------------------------------------------------
// BÖLÜM 1: Model yükle, OQ-B metrikleri
// ---------------------------------------------------------------------------

console.log("=== AEGIS Faz 4 Kalibrasyon — Başlatılıyor ===\n");

const tImp0 = Date.now();
const memImp0 = process.memoryUsage().rss;
const { pipeline, env } = await import("@huggingface/transformers");
env.allowLocalModels = false;
env.cacheDir = process.env.TANCMARK_TRANSFORMERS_CACHE
  ?? new URL("../../../.cache/transformers/", import.meta.url).pathname;
const tImport = Date.now() - tImp0;

const tLoad0 = Date.now();
const memLoad0 = process.memoryUsage().rss;
const extractor = await pipeline(
  "feature-extraction",
  "Xenova/paraphrase-multilingual-mpnet-base-v2",
  { dtype: "q8" },
);
const tColdStart = Date.now() - tLoad0;
const memAfterLoad = process.memoryUsage().rss;

// İlk inference (warm-up): kapsanan ilk çağrı genellikle kernel-init yapar.
const tWarm0 = Date.now();
await extractor("Bu bir ısınma cümlesidir.", { pooling: "mean", normalize: true });
const tWarm = Date.now() - tWarm0;

// Sıcak inference timing — 10 örnek üzerinden
const warmSentences = CORPUS_TR_V1.slice(0, 10).map((c) => c.text);
const tHot0 = Date.now();
for (const s of warmSentences) {
  await extractor(s, { pooling: "mean", normalize: true });
}
const tHotPerSentence = (Date.now() - tHot0) / warmSentences.length;

console.log(`OQ-B raporlama:`);
console.log(`  Import:           ${tImport} ms`);
console.log(`  Cold-start (load):${tColdStart} ms`);
console.log(`  Warm-up call:     ${tWarm} ms`);
console.log(`  Hot inference:    ${tHotPerSentence.toFixed(1)} ms/cümle (n=10)`);
console.log(`  Δmem (model):     ${bytesToMB(memAfterLoad - memImp0)} MB`);
console.log("");

const oqb = {
  importMs: tImport,
  coldStartMs: tColdStart,
  warmUpMs: tWarm,
  hotPerSentenceMs: +tHotPerSentence.toFixed(2),
  memDeltaMB: +bytesToMB(memAfterLoad - memImp0),
  modelDim: 768,
  dtype: "q8",
};

// ---------------------------------------------------------------------------
// BÖLÜM 2: Korpus sanity
// ---------------------------------------------------------------------------

const cstats = corpusStats();
console.log("Korpus:", cstats);
console.log("");

// ---------------------------------------------------------------------------
// Yardımcı: cümle → embedding (Float32Array, normalize)
// ---------------------------------------------------------------------------

async function embed(text) {
  const out = await extractor(text, { pooling: "mean", normalize: true });
  return out.data; // Float32Array(768)
}

// ---------------------------------------------------------------------------
// BÖLÜM 3a: Tekli operatör Δemb dağılımı
// ---------------------------------------------------------------------------

console.log("Bölüm 3a: Tekli operatör Δemb ölçümü...");
const perOp = Object.fromEntries(PERTURBATIONS.map((op) => [op.name, {
  cosine: [], l2: [], applicableCount: 0,
}]));

const baseEmbeddings = new Map(); // id → embedding (cache)

const tMeas0 = Date.now();
let measDone = 0;
for (const c of CORPUS_TR_V1) {
  const baseEmb = await embed(c.text);
  baseEmbeddings.set(c.id, baseEmb);
  for (const op of PERTURBATIONS) {
    if (!op.applicable(c.text)) continue;
    perOp[op.name].applicableCount++;
    const variantText = op.apply(c.text);
    if (variantText === c.text) continue;
    const vEmb = await embed(variantText);
    perOp[op.name].cosine.push(cosineDist(baseEmb, vEmb));
    perOp[op.name].l2.push(l2dist(baseEmb, vEmb));
  }
  measDone++;
  if (measDone % 25 === 0) {
    console.log(`  ${measDone}/${CORPUS_TR_V1.length} cümle işlendi (${((Date.now() - tMeas0)/1000).toFixed(1)}s)`);
  }
}
const tMeas3a = Date.now() - tMeas0;
console.log(`Bölüm 3a tamam: ${(tMeas3a/1000).toFixed(1)}s\n`);

const opSummary = {};
for (const [name, data] of Object.entries(perOp)) {
  const c = meanStd(data.cosine);
  const l = meanStd(data.l2);
  const qC = quantiles(data.cosine, [0.05, 0.5, 0.95]);
  opSummary[name] = {
    applicable: data.applicableCount,
    n: data.cosine.length,
    cosine: { mean: +fmt(c.mean, 6), std: +fmt(c.std, 6),
              p05: +fmt(qC[0.05], 6), p50: +fmt(qC[0.5], 6), p95: +fmt(qC[0.95], 6) },
    l2: { mean: +fmt(l.mean, 6), std: +fmt(l.std, 6) },
  };
}
console.table(Object.fromEntries(Object.entries(opSummary).map(([k, v]) =>
  [k, { n: v.n, cos_mean: v.cosine.mean, cos_p50: v.cosine.p50, cos_p95: v.cosine.p95, l2_mean: v.l2.mean }],
)));

// ---------------------------------------------------------------------------
// BÖLÜM 3b: Kova hedefleme — bit kapasitesi ölçümü
// ---------------------------------------------------------------------------
//
// Strateji:
// - Her cümle için deterministik projeksiyon yönü d (sentence-spesifik).
// - score(v) = v · d (skalar).
// - Tüm uygulanabilir perturbation kombinasyonlarını (≤3 derinlik) üret;
//   her variant için score hesapla.
// - Score dağılımı içinden adaptif step seç: step = max(p95-p05) / (N*2).
//   (En azından N bucket'a açıkça dağılma şansı.)
// - Bucket: floor((score - score_min) / step) mod N.
// - Coverage(N) = (unique buckets across variants) / N, cümle başına ortalama.
//
// "Hill-climb" yorumu: tüm tekli/ikili/üçlü kombinasyonlar yeterince zengin
// arama uzayı (≤ 25 variant), pratik watermark gömme ihtiyacı için bu uzay
// arasından hedef bucket'a ulaşan en az bir variant olup olmadığı sorulur.

console.log("\nBölüm 3b: Kova hedefleme + coverage ölçümü...");

const N_LIST = [2, 4, 8, 16];
const tBucket0 = Date.now();

const perSentence = []; // detaylı veri her cümle için
let bucketsProcessed = 0;
for (const c of CORPUS_TR_V1) {
  const baseEmb = baseEmbeddings.get(c.id);
  const d = projectionDirection(c.id, baseEmb.length);
  const scoreBase = dot(baseEmb, d);
  const { applicableCount, variants } = generateVariants(c.text, 3);
  const scores = [scoreBase];
  for (const v of variants) {
    const e = await embed(v.text);
    scores.push(dot(e, d));
  }
  // Min/max/range
  const sMin = Math.min(...scores);
  const sMax = Math.max(...scores);
  const sRange = sMax - sMin;
  // Step: adaptif. Range >0 değilse min step kullan.
  const baseStep = sRange > 0 ? sRange / 16 : 1e-6; // 16 bucket için doğal adım
  const perN = {};
  for (const N of N_LIST) {
    // Adım: range varsa range/N; aksi halde baseStep.
    const step = sRange > 0 ? sRange / N : baseStep;
    const buckets = new Set();
    for (const s of scores) {
      const b = Math.floor((s - sMin) / step);
      buckets.add(Math.min(b, N - 1));
    }
    perN[N] = { uniqueBuckets: buckets.size, coverage: buckets.size / N };
  }
  perSentence.push({
    id: c.id, category: c.category, applicable: applicableCount,
    variantCount: variants.length, scoreRange: sRange,
    perN,
  });
  bucketsProcessed++;
  if (bucketsProcessed % 25 === 0) {
    console.log(`  ${bucketsProcessed}/${CORPUS_TR_V1.length} cümle bucket-test (${((Date.now() - tBucket0)/1000).toFixed(1)}s)`);
  }
}
const tBucket = Date.now() - tBucket0;
console.log(`Bölüm 3b tamam: ${(tBucket/1000).toFixed(1)}s\n`);

// Aggregate: per-N ortalama coverage + per-kategori
const coverageAgg = {};
for (const N of N_LIST) {
  const all = perSentence.map((p) => p.perN[N].coverage);
  const ag = meanStd(all);
  const q = quantiles(all, [0.05, 0.5, 0.95]);
  // Per kategori
  const byCat = {};
  for (const cat of ["hukuk", "teknik", "savunma", "gunluk"]) {
    const arr = perSentence.filter((p) => p.category === cat).map((p) => p.perN[N].coverage);
    const m = meanStd(arr);
    byCat[cat] = +fmt(m.mean, 4);
  }
  // Tam coverage (=1.0) yüzdesi
  const fullCov = perSentence.filter((p) => p.perN[N].coverage >= 0.999).length / perSentence.length;
  coverageAgg[N] = {
    mean: +fmt(ag.mean, 4),
    std: +fmt(ag.std, 4),
    p05: +fmt(q[0.05], 4), p50: +fmt(q[0.5], 4), p95: +fmt(q[0.95], 4),
    fullCoverageRate: +fmt(fullCov, 4),
    byCategory: byCat,
  };
}

console.table(coverageAgg);

// Kapasite kararı: ideal N_BUCKETS — coverage_mean ≥ 0.85 olan en yüksek N.
const idealN = N_LIST.filter((N) => coverageAgg[N].mean >= 0.85).pop() ?? N_LIST[0];
const recommendedN = idealN;

// ---------------------------------------------------------------------------
// BÖLÜM 4: Performans projeksiyonu
// ---------------------------------------------------------------------------
//
// Cloak ≤ 5s, Verify ≤ 3s hedef. Hot inference per-cümle x sentence sayısı.
// Tipik bir doküman: 10-30 cümle. Worst case: 30 cümle × hot ms.
const docSentences = 30;
const cloakInferenceMs = docSentences * tHotPerSentence; // her cümle 1 embedding
const verifyInferenceMs = docSentences * tHotPerSentence;
const cloakOK = cloakInferenceMs <= 5000;
const verifyOK = verifyInferenceMs <= 3000;

// ---------------------------------------------------------------------------
// Rapor üretimi
// ---------------------------------------------------------------------------

const md = `# AEGIS Faz 4 — Kalibrasyon Raporu (Perturbation Budget v1)

> **Bu rapor deneysel bir ölçümdür.** Üretim API sözleşmesi veya veritabanı
> şeması değiştirilmemiştir. Ölçüm \`lib/aegis-core/calibration/\` altında
> izole edilmiş scriptlerle yapılmıştır.

## OQ-B — Model Doğrulama (\`Xenova/paraphrase-multilingual-mpnet-base-v2\`, dtype=q8)

| Metrik | Değer |
|---|---|
| Import gecikmesi | ${oqb.importMs} ms |
| Cold-start (load) | ${oqb.coldStartMs} ms |
| Warm-up çağrı | ${oqb.warmUpMs} ms |
| Hot inference / cümle | ${oqb.hotPerSentenceMs} ms (n=10) |
| Bellek delta (model) | ${oqb.memDeltaMB} MB |
| Embedding boyutu | ${oqb.modelDim} |
| Quantization | ${oqb.dtype} |

## Korpus — Türkçe v1 (n=${cstats.total})

| Kategori | Adet |
|---|---|
| Hukuk | ${cstats.byCategory.hukuk} |
| Teknik | ${cstats.byCategory.teknik} |
| Savunma (sentetik) | ${cstats.byCategory.savunma} |
| Günlük / Haber | ${cstats.byCategory.gunluk} |

Cümle uzunluğu (kelime): min=${cstats.wordCount.min}, max=${cstats.wordCount.max}, ortalama=${cstats.wordCount.mean}.

## Bölüm 3a — Tekli Operatör Δemb Dağılımı

Δemb = perturbation öncesi ve sonrası embedding arasındaki **cosine distance**
(\`1 − cosθ\`). L2 mesafesi de raporlanır. Tüm cümleler model içinde
\`pooling: "mean", normalize: true\` ile çıkarılmıştır.

| Operatör | Uygulanabilir | n | cos μ | cos σ | cos p05 | cos p50 | cos p95 | L2 μ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${Object.entries(opSummary).map(([k, v]) =>
  `| \`${k}\` | ${v.applicable} | ${v.n} | ${v.cosine.mean} | ${v.cosine.std} | ${v.cosine.p05} | ${v.cosine.p50} | ${v.cosine.p95} | ${v.l2.mean} |`
).join("\n")}

**Yorumlama:**
- Daha yüksek **cos μ** → operatör embedding'i daha çok hareket ettiriyor → bit kodlamak için daha güçlü.
- Çok düşük (≤ 1e-4) μ → operatör model perspektifinden neredeyse görünmez; bit ataması güvenilmez.
- Geniş **cos σ** → dağılım heterojen; cümle bağımlılığı yüksek.

## Bölüm 3b — Kova Hedefleme + Coverage

**Strateji:** Her cümle için deterministik 768-dim projeksiyon yönü
\`d = norm(SHA256-zinciri(sentence_id))\`. Score = embedding · d. Tüm
uygulanabilir tekli + ikili + üçlü perturbation kombinasyonları üretildi
(≤ 25 varyant). Bucket = \`floor((score − score_min) / step)\` (adaptif step:
\`range / N\`). Coverage = (unique buckets gözlenen) / N.

| N (bit) | μ coverage | σ | p05 | p50 | p95 | tam-coverage % | hukuk | teknik | savunma | günlük |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${N_LIST.map((N) => {
  const a = coverageAgg[N];
  return `| ${N} (${Math.log2(N)}-bit) | ${a.mean} | ${a.std} | ${a.p05} | ${a.p50} | ${a.p95} | ${(a.fullCoverageRate*100).toFixed(0)}% | ${a.byCategory.hukuk} | ${a.byCategory.teknik} | ${a.byCategory.savunma} | ${a.byCategory.gunluk} |`;
}).join("\n")}

**Yorumlama:**
- **Tam coverage %** = aramanın tüm N kovayı ürettiği cümle oranı. Bu metrik
  pratik watermark gömmek için **gerçek başarı oranını** temsil eder.
- N büyüdükçe coverage düşer çünkü az sayıda variant N kovaya yetmez.
- Adaptif step kullanıldı; bu, küçük score-range cümlelerinde de bucket
  ayrımı yapılabilmesi için (ölçüm sınırı; üretimde sabit-step kullanılırsa
  küçük-range cümleler tek bucket'a sıkışır → coverage daha düşük olur).

## Karar Matrisi

### Kapasite Kararı

\`coverage_mean ≥ 0.85\` koşulunu sağlayan en yüksek N: **N=${recommendedN}**
(${Math.log2(recommendedN)}-bit). Komut C (İnşa) için **N_BUCKETS=${recommendedN}**
ile başlanması önerilir. Tablo üzerinden alternatifler:

${N_LIST.map((N) => `- N=${N}: μ=${coverageAgg[N].mean}, tam=${(coverageAgg[N].fullCoverageRate*100).toFixed(0)}% → ${coverageAgg[N].mean >= 0.85 ? "✅" : "⚠️"}`).join("\n")}

> Not: Bu adaptif-step ölçümünün üst sınırıdır. Üretimde fixed-step ve
> daha geniş arama uzayı (≥ 4 derinlik veya rastgele sampling) ile coverage
> aynı veya daha düşük seyredebilir; kalibrasyon her büyük corpus
> değişikliğinde yenilenmelidir.

### Performans Kararı

Tipik 30 cümlelik doküman için projeksiyon:

| Aşama | Hesap | Sonuç | Hedef | Karar |
|---|---|---:|---:|:---:|
| Cloak (gömme) | 30 × ${oqb.hotPerSentenceMs}ms | ${cloakInferenceMs.toFixed(0)} ms | ≤ 5000 ms | ${cloakOK ? "✅" : "❌"} |
| Verify (doğrulama) | 30 × ${oqb.hotPerSentenceMs}ms | ${verifyInferenceMs.toFixed(0)} ms | ≤ 3000 ms | ${verifyOK ? "✅" : "❌"} |
| Cold-start | bir kez | ${oqb.coldStartMs} ms | — | ${oqb.coldStartMs < 15000 ? "Kabul edilebilir" : "Pre-warm gerekli"} |
| Bellek | sürekli | ${oqb.memDeltaMB} MB | — | ${oqb.memDeltaMB < 1500 ? "Kabul edilebilir" : "Yüksek; izole servis"} |

**Sonuç:** ${cloakOK && verifyOK ? "Performans hedefleri 30-cümle dokümanlar için karşılanıyor." :
  "Performans hedefleri 30-cümle dokümanlar için **karşılanmıyor**; bit-kodlama yapılırken " +
  "her cümle için tek embedding (cloak) + variant'ler verify aşamasında olmadığından " +
  "**hill-climb** üretim akışına çıkarılmalı (offline) veya batched inference + GPU değerlendirilmelidir."}
${recommendedN < 4 ? `\n**Uyarı:** Önerilen N=${recommendedN} bit kapasitesi düşük; mesaj başına çoklu cümle gerektirir.` : ""}

## Sınırlamalar (Bu Ölçümün Kapsamadığı)

- Türkçe **dil-içi paraphrase saldırısı** altında bit dayanıklılığı ölçülmedi
  (sadece tipografik perturbation ekosistemi). Faz 1 paraphrase signal bus'ı
  sayesinde semantik kanal AUX olarak izlenir.
- **Modeli quantize edip etmeme** kararı yapılmadı; q8 default kullanıldı.
  q4 / fp32 karşılaştırması ileride yapılabilir.
- Model kalıcı olarak süreç belleğinde tutulduğu varsayıldı; serverless
  cold-start senaryosu (her istekte yeniden yükleme) bu rapor kapsamı dışıdır.
- Hill-climb burada **enumeration** olarak uygulandı (≤ 25 variant). Daha
  geniş arama uzayı için iteratif simulated annealing değerlendirilebilir.

## Üretim Üzerine Etki

**Yoktur.** Bu ölçüm sırasında değiştirilen kod:
- \`lib/aegis-core/calibration/\` altında: \`corpus_tr_v1.mjs\`,
  \`perturbations.mjs\`, \`measure.mjs\`, bu rapor dosyası.
- \`lib/aegis-core/package.json\` devDependencies: \`@huggingface/transformers\`,
  \`tsx\` (sadece kalibrasyon scriptleri için).
- \`lib/aegis-core/tsconfig.json\` \`include\` alanı zaten yalnızca \`src/\`
  içerdiğinden \`calibration/\` derlemenin parçası değildir; \`@workspace/aegis-core\`
  paketinin tip yüzeyi ve runtime davranışı **değişmemiştir**.
`;

writeFileSync(REPORT_PATH, md, "utf8");
console.log(`\nRapor yazıldı: ${REPORT_PATH}`);
console.log(`\n=== Bitti ===`);
