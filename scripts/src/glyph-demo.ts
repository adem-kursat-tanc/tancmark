import {
  Aegis,
  generateScrambleMap,
  obfuscateText,
  deobfuscateText,
  describeMap,
} from "@workspace/aegis-core";

const secret = process.env.AEGIS_SECRET ?? "demo-secret-please-change";
if (!process.env.AEGIS_SECRET) {
  console.warn("[uyarı] AEGIS_SECRET tanımlı değil, dev varsayılanı kullanılıyor.\n");
}

const aegis = new Aegis({ secret });

console.log("─".repeat(72));
console.log("AEGIS · Karadelik (Glyph Poisoning / PUA Obfuscation) Demo");
console.log("─".repeat(72));

const docId = "report-2026-05-06-A";
const canary = aegis.generateCanary(docId);

console.log("\n[1] Kanarya cümlesi (orijinal, okunabilir):");
console.log(`    ${canary.text}`);

console.log("\n[2] Bu metne özel scramble haritası üretiliyor (PUA U+E000–U+F8FF)...");
const map = aegis.generateScrambleMap(canary.text, {
  seed: `glyph:${docId}`,
  preserveWhitespace: true,
  preserveDigits: false,
  preservePunctuation: true,
});

const entries = describeMap(map);
console.log(`    eşlenen benzersiz karakter sayısı: ${entries.length}`);
console.log("    örnek eşlemeler (ilk 10):");
for (const e of entries.slice(0, 10)) {
  console.log(`      '${e.from}'  →  ${e.codepoint}  ('${e.to}')`);
}

console.log("\n[3] Karadelik metni (scraper bot / LLM tokenizer'ın göreceği):");
const poisoned = aegis.obfuscateText(canary.text, map);
console.log(`    ${poisoned}`);

console.log("\n[4] Ham karakter kodları (insan gözüyle görünmez gerçeklik):");
const codes: string[] = [];
for (const ch of poisoned) {
  const cp = ch.codePointAt(0)!;
  codes.push("U+" + cp.toString(16).toUpperCase().padStart(4, "0"));
}
console.log(`    ${codes.join(" ")}`);

console.log("\n[5] Frontend'de özel font ile bu PUA kodları doğru harflere render edilir.");
console.log("    Doğrulama amaçlı haritayla geri çözüm:");
const restored = aegis.deobfuscateText(poisoned, map);
console.log(`    ${restored}`);
console.log(`    orijinalle birebir mi: ${restored === canary.text}`);

console.log("\n[6] LLM/scraper perspektifi:");
console.log(`    ${poisoned.length} karakterin tamamı PUA aralığında, sözlükte yok.`);
console.log("    Tokenizer bunu <UNK> dizisi olarak görür, anlamsal içerik sıfırdır.");

console.log("\n" + "─".repeat(72));
console.log("Bitti.");
