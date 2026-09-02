# AEGIS Faz 4 — Kalibrasyon Raporu (Perturbation Budget v1)

> **Bu rapor deneysel bir ölçümdür.** Üretim API sözleşmesi veya veritabanı
> şeması değiştirilmemiştir. Ölçüm `lib/aegis-core/calibration/` altında
> izole edilmiş scriptlerle yapılmıştır.

## OQ-B — Model Doğrulama (`Xenova/paraphrase-multilingual-mpnet-base-v2`, dtype=q8)

| Metrik | Değer |
|---|---|
| Import gecikmesi | 230 ms |
| Cold-start (load) | 1731 ms |
| Warm-up çağrı | 13 ms |
| Hot inference / cümle | 14.4 ms (n=10) |
| Bellek delta (model) | 715.4 MB |
| Embedding boyutu | 768 |
| Quantization | q8 |

## Korpus — Türkçe v1 (n=100)

| Kategori | Adet |
|---|---|
| Hukuk | 30 |
| Teknik | 30 |
| Savunma (sentetik) | 20 |
| Günlük / Haber | 20 |

Cümle uzunluğu (kelime): min=8, max=14, ortalama=10.56.

## Bölüm 3a — Tekli Operatör Δemb Dağılımı

Δemb = perturbation öncesi ve sonrası embedding arasındaki **cosine distance**
(`1 − cosθ`). L2 mesafesi de raporlanır. Tüm cümleler model içinde
`pooling: "mean", normalize: true` ile çıkarılmıştır.

| Operatör | Uygulanabilir | n | cos μ | cos σ | cos p05 | cos p50 | cos p95 | L2 μ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `punctuation` | 100 | 100 | 0.009995 | 0.005903 | 0.003906 | 0.008726 | 0.021086 | 0.13649 |
| `whitespace` | 100 | 100 | 0 | 0 | -0.000001 | 0 | 0 | 0 |
| `casing` | 28 | 28 | 0.00505 | 0.003086 | 0.001842 | 0.003795 | 0.012223 | 0.096321 |
| `zeroWidth` | 100 | 100 | 0 | 0 | -0.000001 | 0 | 0 | 0 |
| `emdash` | 0 | 0 | 0 | 0 | NaN | NaN | NaN | 0 |

**Yorumlama:**
- Daha yüksek **cos μ** → operatör embedding'i daha çok hareket ettiriyor → bit kodlamak için daha güçlü.
- Çok düşük (≤ 1e-4) μ → operatör model perspektifinden neredeyse görünmez; bit ataması güvenilmez.
- Geniş **cos σ** → dağılım heterojen; cümle bağımlılığı yüksek.

## Bölüm 3b — Kova Hedefleme + Coverage

**Strateji:** Her cümle için deterministik 768-dim projeksiyon yönü
`d = norm(SHA256-zinciri(sentence_id))`. Score = embedding · d. Tüm
uygulanabilir tekli + ikili + üçlü perturbation kombinasyonları üretildi
(≤ 25 varyant). Bucket = `floor((score − score_min) / step)` (adaptif step:
`range / N`). Coverage = (unique buckets gözlenen) / N.

| N (bit) | μ coverage | σ | p05 | p50 | p95 | tam-coverage % | hukuk | teknik | savunma | günlük |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2 (1-bit) | 1 | 0 | 1 | 1 | 1 | 100% | 1 | 1 | 1 | 1 |
| 4 (2-bit) | 0.57 | 0.1279 | 0.5 | 0.5 | 0.75 | 3% | 0.5583 | 0.5917 | 0.525 | 0.6 |
| 8 (3-bit) | 0.2988 | 0.0864 | 0.25 | 0.25 | 0.5 | 0% | 0.2875 | 0.3167 | 0.2687 | 0.3187 |
| 16 (4-bit) | 0.1537 | 0.0495 | 0.125 | 0.125 | 0.25 | 0% | 0.1479 | 0.1646 | 0.1406 | 0.1594 |

**Yorumlama:**
- **Tam coverage %** = aramanın tüm N kovayı ürettiği cümle oranı. Bu metrik
  pratik watermark gömmek için **gerçek başarı oranını** temsil eder.
- N büyüdükçe coverage düşer çünkü az sayıda variant N kovaya yetmez.
- Adaptif step kullanıldı; bu, küçük score-range cümlelerinde de bucket
  ayrımı yapılabilmesi için (ölçüm sınırı; üretimde sabit-step kullanılırsa
  küçük-range cümleler tek bucket'a sıkışır → coverage daha düşük olur).

## Karar Matrisi

### Kapasite Kararı

`coverage_mean ≥ 0.85` koşulunu sağlayan en yüksek N: **N=2**
(1-bit). Komut C (İnşa) için **N_BUCKETS=2**
ile başlanması önerilir. Tablo üzerinden alternatifler:

- N=2: μ=1, tam=100% → ✅
- N=4: μ=0.57, tam=3% → ⚠️
- N=8: μ=0.2988, tam=0% → ⚠️
- N=16: μ=0.1537, tam=0% → ⚠️

> Not: Bu adaptif-step ölçümünün üst sınırıdır. Üretimde fixed-step ve
> daha geniş arama uzayı (≥ 4 derinlik veya rastgele sampling) ile coverage
> aynı veya daha düşük seyredebilir; kalibrasyon her büyük corpus
> değişikliğinde yenilenmelidir.

### Performans Kararı

Tipik 30 cümlelik doküman için projeksiyon:

| Aşama | Hesap | Sonuç | Hedef | Karar |
|---|---|---:|---:|:---:|
| Cloak (gömme) | 30 × 14.4ms | 432 ms | ≤ 5000 ms | ✅ |
| Verify (doğrulama) | 30 × 14.4ms | 432 ms | ≤ 3000 ms | ✅ |
| Cold-start | bir kez | 1731 ms | — | Kabul edilebilir |
| Bellek | sürekli | 715.4 MB | — | Kabul edilebilir |

**Sonuç:** Performans hedefleri 30-cümle dokümanlar için karşılanıyor.

**Uyarı:** Önerilen N=2 bit kapasitesi düşük; mesaj başına çoklu cümle gerektirir.

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
- `lib/aegis-core/calibration/` altında: `corpus_tr_v1.mjs`,
  `perturbations.mjs`, `measure.mjs`, bu rapor dosyası.
- `lib/aegis-core/package.json` devDependencies: `@huggingface/transformers`,
  `tsx` (sadece kalibrasyon scriptleri için).
- `lib/aegis-core/tsconfig.json` `include` alanı zaten yalnızca `src/`
  içerdiğinden `calibration/` derlemenin parçası değildir; `@workspace/aegis-core`
  paketinin tip yüzeyi ve runtime davranışı **değişmemiştir**.
