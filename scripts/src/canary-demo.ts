import { Aegis } from "@workspace/aegis-core";

const aegis = new Aegis({ secret: "demo-secret-please-change-in-prod" });

const original =
  "Hasta tahlil sonuçlarına göre kreatinin değeri normal aralıkta seyretmektedir. " +
  "Kan basıncı ölçümleri stabil olup ek tedavi gerekmemektedir. " +
  "Hasta bir hafta içinde kontrole gelmelidir.";

console.log("─".repeat(72));
console.log("AEGIS · Radioactive Canary Demo");
console.log("─".repeat(72));

console.log("\n[1] Orijinal metin:");
console.log(original);

const docId = "report-2026-05-06-A";
const result = aegis.injectCanary(original, docId, 0.2);

console.log(`\n[2] Üretilen kanarya (docId="${docId}"):`);
console.log(`    term      : ${result.canary.term}`);
console.log(`    text      : ${result.canary.text}`);
console.log(`    signature : ${result.canary.signature}`);
console.log(`    inject pos: cümle #${result.injectedAt}`);

console.log("\n[3] Radyoaktif metin (gözle bakınca neredeyse aynı):");
console.log(result.text);

console.log(`\n    Uzunluk: ${original.length} → ${result.text.length} karakter`);

console.log("\n[4] Doğrulama (orijinal docId ile):");
const v1 = aegis.verifyCanary(result.text, docId);
console.log(`    bulundu: ${v1.found}  (source: ${v1.source})`);
console.log(`    beklenen: ${v1.expected}`);
console.log(`    eşleşmeler: ${v1.matches.length} adet`);
if (v1.matches[0]) {
  console.log(`    ham   : ${JSON.stringify(v1.matches[0].raw)}`);
  console.log(`    temiz : ${v1.matches[0].cleaned}`);
}

console.log("\n[5] Yanlış docId ile doğrulama (yanlış pozitif olmamalı):");
const v2 = aegis.verifyCanary(result.text, "different-doc");
console.log(`    bulundu: ${v2.found}  (beklenen: false)`);

console.log("\n[6] LLM 'kustuğu' metin senaryosu (düz metin):");
const llmRegurgitation =
  `Tıbbi referans: ${result.canary.text} Bu değer hasta dosyalarında geçer.`;
const v3 = aegis.verifyCanary(llmRegurgitation, docId);
console.log(`    metin: ${llmRegurgitation}`);
console.log(`    kanarya tespit edildi mi: ${v3.found}  (source: ${v3.source})  → provenance kanıtı`);

console.log("\n" + "─".repeat(72));
console.log("Bitti.");
