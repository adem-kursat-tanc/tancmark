import { createHash } from "node:crypto";

export interface CandidateInput {
  clientId: string;
  matchedTokens: number;
  totalTokens: number;
  confidenceScore: number;
}

export interface ChannelBreakdownInput {
  synonym: { matched: number; total: number; score: number };
  homoglyph: { matched: number; total: number; score: number };
  zeroWidth: { matched: number; total: number; score: number; present: boolean };
}

export interface StylometryInput {
  wordCount: number;
  uniqueWordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  lexicalDiversity: number;
  stopWordCount: number;
  stopWordRatio: number;
  avgWordLength: number;
  stopWordDistribution: Array<{ word: string; count: number }>;
}

export interface DiffSummaryInput {
  added: number;
  removed: number;
  unchanged: number;
  similarity: number;
}

export interface SpatialVarianceInput {
  totalChars: number;
  wrap: number;
  carriers: number;
  microXVariance: number;
  microYVariance: number;
}

/**
 * Optional OpenTimestamps proof bundle. Populated by the route from the
 * `timestamp_proofs` table when a row matches the protectedText digest.
 * `status` summarises the per-calendar receipt state and is what the PDF
 * renders as a single Pending / Confirmed / Partial badge.
 */
export interface TimestampProofInput {
  digest: string;
  submittedAt: Date;
  btcAnchored: boolean;
  btcBlock?: number | null;
  status: "anchored" | "partial" | "pending";
  calendars: Array<{ calendar: string; status: string }>;
}

export interface ReportInput {
  suspectText: string;
  protectedText: string;
  suspectedClientId: number | string | null;
  confidenceScore: number;
  matchedTokens: number;
  totalTokens: number;
  candidates?: CandidateInput[];
  channelBreakdown?: ChannelBreakdownInput;
  stylometry?: StylometryInput;
  diffSummary?: DiffSummaryInput;
  spatialVariance?: SpatialVarianceInput;
  expertNotes?: string;
  /** Optional OpenTimestamps (Bitcoin) proof for the protected text. */
  timestamp?: TimestampProofInput;
  /**
   * Optional Cascade Hash integrity report (AEGIS v4.0 Faz 2).
   * Yardımcı kanıttır — bu blok PDF'te ayrı bir "Yapısal Bütünlük Analizi"
   * bölümü olarak basılır. Yokluğunda bölüm hiç çizilmez (defensive).
   * Tek başına suçlama temeli OLAMAZ — verdict ladder ile bağımsız çalışır.
   */
  cascadeIntegrity?: {
    integrityScore: number;
    brokenAtIndex: number | null;
    deletedIndices: number[];
    modifiedIndices: number[];
    reorderedDetected: boolean;
    insertedCount: number;
    totalStored: number;
    totalCandidate: number;
  };
  userId?: string;
  ip: string;
  generatedAt: Date;
  /**
   * Forensic verdict signals. The PDF must NEVER turn `confidenceScore`
   * alone into a definitive accusation — that is a stylometric proximity
   * score and can be high for innocent text. Decisive verdicts come from
   * `absoluteBreach` (single-client honeytoken hit) or `multiSuspect`
   * (≥2 clients with decisive trap evidence).
   */
  absoluteBreach?: boolean;
  multiSuspect?: boolean;
  suspectedClients?: Array<{ clientId: string; confidenceScore: number }>;
  /**
   * AEGIS v4.0 Faz 3 — Tiered Verdict + Channel Integrity Profile.
   * Yokluğunda PDF "Çoklu Kanal Bütünlük Analizi" bölümü çizilmez.
   * Cascade kanalı AUX olarak listelenir ama verdict'e GİRMEZ.
   */
  tieredVerdict?: {
    verdict: "STRONG" | "AMBIGUOUS" | "INSUFFICIENT";
    attributedClientIds: string[];
    reasons: string[];
    marginGuardDemoted: boolean;
    multiSuspectDemoted: boolean;
    margin: number | null;
    strongCandidateCount: number;
    channelProfile: Array<{
      name: string;
      tier: "T0" | "T1" | "T2" | "AUX";
      score: number;
      decay: number;
      vital: boolean;
      present: boolean;
      note?: string;
    }>;
  };
  /**
   * AEGIS v4.1 Step 2 — Decoy Layer match (analyze-text yardımcısı).
   * Yokluğunda PDF "Decoy Layer" bölümü çizilmez. Verdict ladder'a GİRMEZ
   * — tek başına suçlama temeli OLAMAZ; bireysel viewer atfı için kanıt.
   */
  decoyMatch?: {
    tokensFound: number;
    tagCodepointCount: number;
    multiEmission: boolean;
    primaryEmission: {
      clientId: string;
      docId: string;
      viewerId: string;
      emittedAt: string;
    } | null;
    otherEmissions: Array<{
      clientId: string;
      viewerId: string;
      emittedAt: string;
    }>;
    unknownTokenCount: number;
  };
  /**
   * AEGIS v4.1 Step 2.5 — Advance Confidence Fix.
   * Vault (PQC) katmanı yokken `matchConfidence` her zaman `"preliminary"`.
   * Vault devreye girdiğinde verify başarılıysa `"vault-confirmed"` döner.
   * PDF: `"preliminary"` ise raporun başında "Ön Bulgu" uyarı bandı çizilir.
   */
  primarySuspect?: {
    source: "honeytoken" | "multi-channel" | "decoy" | "none";
    clientId: string | null;
    decoyViewerId?: string;
    matchConfidence: "preliminary" | "vault-confirmed";
  };
}

export type ForensicVerdict =
  | { level: "strong"; clientId: string | number; label: string }
  | { level: "ambiguous"; clients: string[]; label: string }
  | { level: "insufficient"; label: string };

export function classifyVerdict(input: {
  absoluteBreach?: boolean;
  multiSuspect?: boolean;
  suspectedClientId: number | string | null;
  suspectedClients?: Array<{ clientId: string }>;
}): ForensicVerdict {
  // Distinct-clientId guard: ambiguous requires ≥2 *unique* trimmed IDs.
  // A duplicated/whitespace-only payload must NOT downgrade a strong hit.
  const distinctIds = Array.from(
    new Set(
      (input.suspectedClients ?? [])
        .map((s) => (typeof s.clientId === "string" ? s.clientId.trim() : ""))
        .filter((id) => id.length > 0),
    ),
  );
  if (input.multiSuspect && distinctIds.length >= 2) {
    return {
      level: "ambiguous",
      clients: distinctIds,
      label: "Birden fazla kaynak izi — kesin tek kaynak yok",
    };
  }
  if (
    input.absoluteBreach === true &&
    input.suspectedClientId !== null &&
    input.suspectedClientId !== undefined
  ) {
    return {
      level: "strong",
      clientId: input.suspectedClientId,
      label: "Güçlü teknik eşleşme",
    };
  }
  return {
    level: "insufficient",
    label: "Kesin kaynak tespit edilemedi (kanıt yetersiz)",
  };
}

export interface GeneratedReport {
  buffer: Buffer;
  sha256: string;
  byteLength: number;
}

const COLORS = {
  bg: "#0B0F14",
  panel: "#111827",
  border: "#1F2937",
  text: "#E5E7EB",
  muted: "#9CA3AF",
  primary: "#10B981",
  danger: "#EF4444",
  accent: "#34D399",
};

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 50;

function tokenizeWithMarks(
  source: string,
  compareTo: string,
): Array<{ text: string; mark: boolean }> {
  const srcParts = source.split(/(\s+)/);
  const cmpParts = compareTo.split(/(\s+)/);
  return srcParts.map((part, i) => {
    if (part.trim() === "") return { text: part, mark: false };
    const other = cmpParts[i];
    return { text: part, mark: other !== undefined && other !== part };
  });
}

function drawHeaderBand(doc: PDFKit.PDFDocument): void {
  doc.save();
  doc.rect(0, 0, PAGE.width, 90).fill(COLORS.panel);
  doc.fillColor(COLORS.primary).fontSize(20).font("Helvetica-Bold").text("TancMark", MARGIN, 30);
  doc
    .fillColor(COLORS.muted)
    .fontSize(10)
    .font("Helvetica")
    .text("Forensic Attribution Report", MARGIN, 56);
  doc
    .fillColor(COLORS.accent)
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("CONFIDENTIAL", PAGE.width - MARGIN - 90, 36, { width: 90, align: "right" });
  doc.restore();
}

function drawFooter(doc: PDFKit.PDFDocument, pageNum: number, totalLabel: string): void {
  doc.save();
  const y = PAGE.height - 36;
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE.width - MARGIN, y)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke();
  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .font("Helvetica")
    .text(`TancMark · ${totalLabel}`, MARGIN, y + 8, { width: 300 });
  doc.text(`Sayfa ${pageNum}`, PAGE.width - MARGIN - 60, y + 8, { width: 60, align: "right" });
  doc.restore();
}

function drawSectionTitle(doc: PDFKit.PDFDocument, label: string): void {
  doc.moveDown(0.6);
  const y = doc.y;
  doc.save();
  doc.rect(MARGIN, y, 3, 14).fill(COLORS.primary);
  doc
    .fillColor(COLORS.text)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(label, MARGIN + 10, y, { lineBreak: false });
  doc.restore();
  doc.moveDown(0.8);
}

function drawKeyValueRow(
  doc: PDFKit.PDFDocument,
  rows: Array<[string, string]>,
): void {
  const labelWidth = 130;
  const valueX = MARGIN + labelWidth;
  const valueWidth = PAGE.width - MARGIN - valueX;
  for (const [k, v] of rows) {
    const startY = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(k, MARGIN, startY, { width: labelWidth });
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(v, valueX, startY, { width: valueWidth });
    doc.moveDown(0.3);
  }
}

function drawTextPanel(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  tokens: Array<{ text: string; mark: boolean }>,
  markColor: string,
): void {
  doc.save();
  doc.roundedRect(x, y, width, height, 4).fillAndStroke(COLORS.panel, COLORS.border);
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(title.toUpperCase(), x + 10, y + 8, { width: width - 20 });

  const contentY = y + 26;
  const contentHeight = height - 32;
  doc.save();
  doc.rect(x + 8, contentY, width - 16, contentHeight).clip();

  let cursorX = x + 10;
  let cursorY = contentY;
  const maxX = x + width - 10;
  const lineHeight = 11;
  doc.font("Courier").fontSize(8.5);

  for (const tok of tokens) {
    if (tok.text.includes("\n")) {
      const segs = tok.text.split("\n");
      for (let i = 0; i < segs.length; i++) {
        if (segs[i]) {
          const w = doc.widthOfString(segs[i]!);
          if (cursorX + w > maxX) {
            cursorX = x + 10;
            cursorY += lineHeight;
          }
          doc.fillColor(COLORS.text).text(segs[i]!, cursorX, cursorY, { lineBreak: false });
          cursorX += w;
        }
        if (i < segs.length - 1) {
          cursorX = x + 10;
          cursorY += lineHeight;
        }
      }
      continue;
    }

    const w = doc.widthOfString(tok.text);
    if (cursorX + w > maxX) {
      cursorX = x + 10;
      cursorY += lineHeight;
    }
    if (cursorY > contentY + contentHeight - lineHeight) break;

    if (tok.mark) {
      doc.save();
      doc.rect(cursorX - 0.5, cursorY - 1, w + 1, lineHeight - 1).fill(markColor);
      doc.restore();
      doc.fillColor("#FFFFFF");
    } else {
      doc.fillColor(COLORS.text);
    }
    doc.text(tok.text, cursorX, cursorY, { lineBreak: false });
    cursorX += w;
  }

  doc.restore();
  doc.restore();
}

function drawSignatureInventory(
  doc: PDFKit.PDFDocument,
  cb: ChannelBreakdownInput,
): void {
  const startY = doc.y;
  const tableW = PAGE.width - MARGIN * 2;
  const rowH = 22;
  const headerH = 20;
  const colWidths = [150, 130, 90, tableW - 150 - 130 - 90]; // Kanal, Eşleşme, Skor, Yorum

  doc.save();
  // Header
  doc.rect(MARGIN, startY, tableW, headerH).fill(COLORS.panel);
  doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(8);
  let cx = MARGIN + 8;
  const headers = ["KANAL", "EŞLEŞME", "SKOR", "DURUM"];
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i]!, cx, startY + 6, { width: colWidths[i]! - 10, lineBreak: false });
    cx += colWidths[i]!;
  }
  doc.restore();

  const rows: Array<{ name: string; matched: string; score: string; status: string; ok: boolean }> = [
    {
      name: "Linguistic DNA (eş-anlamlı)",
      matched: `${cb.synonym.matched} / ${cb.synonym.total}`,
      score: cb.synonym.total > 0 ? `${(cb.synonym.score * 100).toFixed(1)}%` : "—",
      status: cb.synonym.total > 0 ? (cb.synonym.score >= 0.7 ? "Tespit Edildi" : "Kısmi") : "Veri Yok",
      ok: cb.synonym.total > 0 && cb.synonym.score >= 0.7,
    },
    {
      name: "Homoglyph (Latin↔Kiril)",
      matched: `${cb.homoglyph.matched} / ${cb.homoglyph.total}`,
      score: cb.homoglyph.total > 0 ? `${(cb.homoglyph.score * 100).toFixed(1)}%` : "—",
      status: cb.homoglyph.total > 0 ? (cb.homoglyph.score >= 0.9 ? "Tespit Edildi" : "Kısmi") : "Veri Yok",
      ok: cb.homoglyph.total > 0 && cb.homoglyph.score >= 0.9,
    },
    {
      name: "Zero-Width (16-bit hash)",
      matched: cb.zeroWidth.present ? `${cb.zeroWidth.matched} / ${cb.zeroWidth.total}` : "—",
      score: cb.zeroWidth.present ? `${(cb.zeroWidth.score * 100).toFixed(1)}%` : "—",
      status: cb.zeroWidth.present ? (cb.zeroWidth.score >= 0.95 ? "Mevcut" : "Bozulmuş") : "Yok",
      ok: cb.zeroWidth.present && cb.zeroWidth.score >= 0.95,
    },
  ];

  let y = startY + headerH;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    doc.save();
    doc.rect(MARGIN, y, tableW, rowH).fillAndStroke(i % 2 === 0 ? COLORS.bg : COLORS.panel, COLORS.border);
    doc.restore();
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.text);
    let xx = MARGIN + 8;
    doc.text(r.name, xx, y + 7, { width: colWidths[0]! - 10, lineBreak: false });
    xx += colWidths[0]!;
    doc.fillColor(COLORS.muted).text(r.matched, xx, y + 7, { width: colWidths[1]! - 10, lineBreak: false });
    xx += colWidths[1]!;
    doc
      .fillColor(r.ok ? COLORS.primary : COLORS.muted)
      .font("Helvetica-Bold")
      .text(r.score, xx, y + 7, { width: colWidths[2]! - 10, lineBreak: false });
    xx += colWidths[2]!;
    doc
      .font("Helvetica")
      .fillColor(r.ok ? COLORS.accent : COLORS.muted)
      .text(r.status, xx, y + 7, { width: colWidths[3]! - 10, lineBreak: false });
    y += rowH;
  }

  doc.y = y + 6;
}

// ----------------------------------------------------------------------
// Advanced evidence-block renderers.
// ----------------------------------------------------------------------

function drawStylometryBlock(doc: PDFKit.PDFDocument, s: StylometryInput): void {
  drawSectionTitle(doc, "Üslup Analizi (Stylometric DNA)");
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(
      "Yüzey-seviyesi üslup parmak izi: cümle uzunluğu, sözcüksel çeşitlilik ve " +
        "Türkçe stop-word dağılımı. Watermark katmanları kaldırılsa dahi yazara " +
        "bağlı bir kanal olarak kullanılır.",
      MARGIN,
      doc.y,
      { width: PAGE.width - MARGIN * 2 },
    );
  doc.moveDown(0.6);

  drawKeyValueRow(doc, [
    ["Toplam kelime", String(s.wordCount)],
    ["Tekil kelime", `${s.uniqueWordCount}`],
    ["Cümle sayısı", String(s.sentenceCount)],
    ["Ortalama cümle uzunluğu", `${s.avgSentenceLength.toFixed(2)} kelime`],
    ["Sözcüksel çeşitlilik (TTR)", s.lexicalDiversity.toFixed(3)],
    ["Stop-word oranı", `${(s.stopWordRatio * 100).toFixed(2)}%`],
    ["Ortalama kelime uzunluğu", `${s.avgWordLength.toFixed(2)} karakter`],
  ]);

  if (s.stopWordDistribution.length > 0) {
    doc.moveDown(0.3);
    doc
      .fillColor(COLORS.muted)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("STOP-WORD DAĞILIMI", MARGIN, doc.y);
    doc.moveDown(0.3);

    // 3-column compact grid: word + count.
    const cols = 3;
    const colW = (PAGE.width - MARGIN * 2) / cols;
    const rowH = 14;
    const rows = Math.ceil(s.stopWordDistribution.length / cols);
    const startY = doc.y;
    for (let i = 0; i < s.stopWordDistribution.length; i++) {
      const e = s.stopWordDistribution[i]!;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = MARGIN + col * colW;
      const y = startY + row * rowH;
      doc.font("Helvetica").fontSize(9).fillColor(COLORS.text).text(e.word, x + 4, y, {
        width: colW * 0.6,
        lineBreak: false,
      });
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.accent)
        .text(String(e.count), x + colW * 0.65, y, {
          width: colW * 0.3,
          lineBreak: false,
          align: "right",
        });
    }
    doc.y = startY + rows * rowH + 4;
  }
}

function drawDiffBlock(doc: PDFKit.PDFDocument, d: DiffSummaryInput): void {
  drawSectionTitle(doc, "Fark Analizi (Visual Diff)");
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(
      "Sızdırılan metin ile sistem mührü arasındaki kelime düzeyinde fark dökümü. " +
        "Eklenen kelimeler şüphelide bulunup orijinalde olmayan, çıkarılanlar ise " +
        "tam tersidir. Benzerlik = değişmemiş / (değişmemiş + eklenen + çıkarılan).",
      MARGIN,
      doc.y,
      { width: PAGE.width - MARGIN * 2 },
    );
  doc.moveDown(0.5);

  // Three colored stat cards.
  const tableW = PAGE.width - MARGIN * 2;
  const cardW = (tableW - 16) / 3;
  const startY = doc.y;
  const cardH = 56;
  const cards: Array<{ label: string; value: string; color: string }> = [
    { label: "DEĞİŞMEMİŞ", value: String(d.unchanged), color: COLORS.primary },
    { label: "EKLENEN", value: String(d.added), color: COLORS.accent },
    { label: "ÇIKARILAN", value: String(d.removed), color: COLORS.danger },
  ];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]!;
    const x = MARGIN + i * (cardW + 8);
    doc.save();
    doc.roundedRect(x, startY, cardW, cardH, 4).fillAndStroke(COLORS.panel, COLORS.border);
    doc.restore();
    doc
      .fillColor(COLORS.muted)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(c.label, x + 12, startY + 10, { width: cardW - 24 });
    doc
      .fillColor(c.color)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(c.value, x + 12, startY + 24, { width: cardW - 24 });
  }
  doc.y = startY + cardH + 8;

  drawKeyValueRow(doc, [["Benzerlik Skoru", `${(d.similarity * 100).toFixed(2)}%`]]);
}

function drawSpatialVarianceBlock(
  doc: PDFKit.PDFDocument,
  v: SpatialVarianceInput,
): void {
  drawSectionTitle(doc, "Mikro-Boşluk ve Karakter Varyans Verisi");
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(
      "Görsel parmak izi: mühürlü metnin her karakterinin sentetik ızgara " +
        "üzerindeki yerleşimi ve kod-noktası türetimli mikro-ofset varyansı. " +
        "Sıfır-genişlikli (zero-width) ve homoglyph taşıyıcılar 'carrier' olarak " +
        "işaretlenir; varyans değerleri taşıyıcı yoğunluğuyla birlikte adli " +
        "teknik kayıt olarak saklanır.",
      MARGIN,
      doc.y,
      { width: PAGE.width - MARGIN * 2 },
    );
  doc.moveDown(0.5);

  drawKeyValueRow(doc, [
    ["Toplam karakter", String(v.totalChars)],
    ["Izgara genişliği (wrap)", String(v.wrap)],
    ["Taşıyıcı (ZW + homoglyph)", String(v.carriers)],
    ["Mikro-X varyansı", v.microXVariance.toExponential(3)],
    ["Mikro-Y varyansı", v.microYVariance.toExponential(3)],
    [
      "Taşıyıcı yoğunluğu",
      v.totalChars > 0
        ? `${((v.carriers / v.totalChars) * 100).toFixed(2)}%`
        : "—",
    ],
  ]);
}

function drawExpertNotesBlock(
  doc: PDFKit.PDFDocument,
  notes: string,
  ensureSpace: (needed: number) => void,
): void {
  // Header (title + caption) — measure header needs first.
  ensureSpace(80);
  drawSectionTitle(doc, "Uzman Yorumu");
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(
      "Aşağıdaki yorum, raporu hazırlayan adli analist tarafından sisteme " +
        "kaydedilmiştir ve denetim kaydında forensic_notes tablosunda saklanır.",
      MARGIN,
      doc.y,
      { width: PAGE.width - MARGIN * 2 },
    );
  doc.moveDown(0.5);

  const tableW = PAGE.width - MARGIN * 2;
  const PAGE_BUDGET = PAGE.height - 70 - 110; // footer threshold − header bottom
  // Strip control characters (except \n) so PDFKit never sees a NUL/etc.
  const sanitized = notes
    .replace(/\r\n/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
  const padded = `\u201C${sanitized}\u201D`;

  // Measure full text height; if it doesn't fit on the current page, split
  // into chunks that each fit on a fresh page (no truncation, no overflow).
  doc.font("Helvetica-Oblique").fontSize(10).fillColor(COLORS.text);
  const fullHeight = doc.heightOfString(padded, { width: tableW - 24, align: "left" });

  // Available space on the current page (after header + caption).
  let availableNow = PAGE.height - 70 - doc.y;

  // If total fits in available space, single panel and we're done.
  if (fullHeight + 24 <= availableNow) {
    const panelH = Math.max(60, fullHeight + 24);
    const startY = doc.y;
    doc.save();
    doc.roundedRect(MARGIN, startY, tableW, panelH, 4).fillAndStroke(COLORS.panel, COLORS.border);
    doc.restore();
    doc.fillColor(COLORS.text).text(padded, MARGIN + 12, startY + 12, {
      width: tableW - 24,
      align: "left",
    });
    doc.y = startY + panelH + 6;
    return;
  }

  // Multi-page case: split text into chunks. Use rough char-per-px ratio
  // derived from the measured full height to estimate chunk size.
  const totalChars = padded.length;
  // chars-per-pixel-of-height; guard against div-by-zero.
  const cpp = fullHeight > 0 ? totalChars / fullHeight : totalChars;

  let cursor = 0;
  while (cursor < totalChars) {
    // Decide budget for THIS panel.
    const headerSlackY = doc.y;
    const remainingPageHeight = PAGE.height - 70 - headerSlackY;
    let budgetH: number;
    if (remainingPageHeight >= 80) {
      budgetH = remainingPageHeight - 8; // minus a little spacing
    } else {
      // Move to next page first.
      ensureSpace(PAGE_BUDGET); // forces addPage
      budgetH = PAGE.height - 70 - doc.y - 8;
    }
    budgetH = Math.min(budgetH, PAGE_BUDGET);

    // Estimate slice length, then trim by re-measurement.
    let sliceLen = Math.max(60, Math.floor(budgetH * cpp));
    sliceLen = Math.min(sliceLen, totalChars - cursor);
    let slice = padded.slice(cursor, cursor + sliceLen);
    let measured = doc.heightOfString(slice, { width: tableW - 24, align: "left" });
    // Shrink until it fits.
    while (measured + 24 > budgetH && slice.length > 30) {
      sliceLen = Math.floor(slice.length * 0.85);
      slice = padded.slice(cursor, cursor + sliceLen);
      measured = doc.heightOfString(slice, { width: tableW - 24, align: "left" });
    }
    // Try to break at a whitespace boundary near the end.
    const wsBreak = slice.lastIndexOf(" ");
    if (wsBreak > slice.length * 0.5 && cursor + slice.length < totalChars) {
      slice = slice.slice(0, wsBreak);
      measured = doc.heightOfString(slice, { width: tableW - 24, align: "left" });
    }

    const panelH = Math.max(60, measured + 24);
    const startY = doc.y;
    doc.save();
    doc.roundedRect(MARGIN, startY, tableW, panelH, 4).fillAndStroke(COLORS.panel, COLORS.border);
    doc.restore();
    doc.fillColor(COLORS.text).text(slice, MARGIN + 12, startY + 12, {
      width: tableW - 24,
      align: "left",
    });
    doc.y = startY + panelH + 6;

    cursor += slice.length;

    if (cursor < totalChars) {
      // Force a fresh page for the next chunk.
      ensureSpace(PAGE_BUDGET);
    }
  }
}

function drawTimestampBlock(
  doc: PDFKit.PDFDocument,
  t: TimestampProofInput,
): void {
  drawSectionTitle(doc, "Yasal Zaman Damgası · OpenTimestamps (Bitcoin)");
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(
      "Mühürlü metnin SHA-256 özeti, OpenTimestamps takvim sunucularına " +
        "gönderilmiş ve Bitcoin blok zincirine bağlanmaya aday alınmıştır. " +
        "BTC ANCHORED = takvim sunucusu kaydı bir Bitcoin bloğuna çapaladı (kanıt zincire yazıldı). " +
        "PENDING = takvim sunucusu kabul etti; OpenTimestamps onay süreci ortalama 6-24 saat sürer.",
      MARGIN,
      doc.y,
      { width: PAGE.width - MARGIN * 2 },
    );
  doc.moveDown(0.5);

  const statusLabel =
    t.status === "anchored"
      ? "BTC ANCHORED · ÇAPALANDI"
      : t.status === "partial"
        ? "PARTIAL · KISMEN ÇAPALANDI"
        : "PENDING · BTC ONAYI BEKLENİYOR";
  const statusColor =
    t.status === "anchored" ? COLORS.primary : t.status === "partial" ? COLORS.accent : COLORS.muted;

  // Status badge bar.
  const tableW = PAGE.width - MARGIN * 2;
  const badgeY = doc.y;
  doc.save();
  doc.roundedRect(MARGIN, badgeY, tableW, 28, 4).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();
  doc
    .fillColor(statusColor)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(statusLabel, MARGIN + 12, badgeY + 8, { width: tableW - 24 });
  doc.y = badgeY + 36;

  const explorerRow: Array<[string, string]> =
    t.btcBlock !== null && t.btcBlock !== undefined
      ? [
          ["BTC Blok #", String(t.btcBlock)],
          ["Block Explorer", `https://mempool.space/block/${t.btcBlock}`],
        ]
      : [];
  drawKeyValueRow(doc, [
    ["Belge SHA-256", t.digest],
    ["Gönderim Zamanı", fmtTimestamp(t.submittedAt)],
    ["Bitcoin Çapası", t.btcAnchored ? "Var (anchored)" : "Henüz yok (pending)"],
    ...explorerRow,
    [
      "Takvim Sunucuları",
      t.calendars.length > 0
        ? t.calendars.map((c) => `${c.calendar}=${c.status}`).join(", ")
        : "—",
    ],
  ]);
}

function fmtTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

function pctText(score: number): string {
  return `${(score * 100).toFixed(2)}%`;
}

/**
 * Yapısal Bütünlük Analizi · Cascade Hash (AEGIS v4.0 Faz 2)
 *
 * Cümle bazlı HMAC zincirinden çıkarılan bütünlük raporu. Bu blok yardımcı
 * kanıttır — silme/değiştirme/yer değiştirme haritası verir ama tek başına
 * suçlama temeli değildir. PDF okuyucusuna açıkça hatırlatılır.
 */
function drawCascadeIntegrityBlock(
  doc: PDFKit.PDFDocument,
  c: NonNullable<ReportInput["cascadeIntegrity"]>,
): void {
  drawSectionTitle(doc, "Yapısal Bütünlük Analizi · Cascade Hash");
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(
      "Mühürleme sırasında metnin her cümlesi bir önceki cümlenin hash'iyle " +
        "kriptografik olarak zincirlenir (HMAC). Bu bölüm zincirin neresinde " +
        "kırılma olduğunu gösterir: silinen, değiştirilen, yeri değiştirilen " +
        "cümleler. Yardımcı kanıttır — tek başına suçlama temeli değildir; " +
        "asıl atıf çok kanallı skor + honeytoken üzerinden yapılır.",
      MARGIN,
      doc.y,
      { width: PAGE.width - MARGIN * 2 },
    );
  doc.moveDown(0.5);

  const score = c.integrityScore;
  const statusLabel =
    score >= 1
      ? "INTACT · ZINCIR BÜTÜN"
      : score < 0.5
        ? "SEVERE · CIDDI MANIPÜLASYON"
        : score < 0.8
          ? "BROKEN · KISMI MANIPÜLASYON"
          : "MINOR · KÜÇÜK SAPMA";
  const statusColor =
    score >= 1
      ? COLORS.primary
      : score < 0.5
        ? COLORS.accent
        : score < 0.8
          ? COLORS.accent
          : COLORS.muted;

  const tableW = PAGE.width - MARGIN * 2;
  const badgeY = doc.y;
  doc.save();
  doc.roundedRect(MARGIN, badgeY, tableW, 28, 4).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();
  doc
    .fillColor(statusColor)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(statusLabel, MARGIN + 12, badgeY + 8, { width: tableW - 24 });
  doc.y = badgeY + 36;

  const fmtIdxList = (xs: number[]): string =>
    xs.length === 0 ? "—" : xs.slice(0, 12).map((i) => `#${i + 1}`).join(", ") + (xs.length > 12 ? ", …" : "");

  drawKeyValueRow(doc, [
    ["Bütünlük Skoru", `${(score * 100).toFixed(1)}%`],
    ["İlk Kırılma Cümlesi", c.brokenAtIndex === null ? "—" : `#${c.brokenAtIndex + 1}`],
    ["Saklı Cümle Sayısı", String(c.totalStored)],
    ["Aday Cümle Sayısı", String(c.totalCandidate)],
    ["Silinen Cümleler", fmtIdxList(c.deletedIndices)],
    ["Değiştirilen Cümleler", fmtIdxList(c.modifiedIndices)],
    ["Eklenen Cümle Sayısı", String(c.insertedCount)],
    ["Yer Değiştirme", c.reorderedDetected ? "Tespit edildi" : "—"],
  ]);
}

/**
 * AEGIS v4.0 Faz 3 — Çoklu Kanal Bütünlük Analizi (Tiered Verdict).
 * Per-kanal tier/skor/decay tablosu + verdict badge + reasons listesi.
 * Cascade AUX olarak listelenir fakat verdict'e girmediği AÇIKÇA belirtilir.
 */
/**
 * AEGIS v4.1 Step 2 — Decoy Layer (Individualized Emission) raporu.
 *
 * Yardımcı kanıttır: tek başına suçlama temeli OLAMAZ. Bu blok hangi
 * VIEWER'a yapılan teslim'in suspect text içinde göründüğünü belgeler;
 * legal-grade ifade ile "individualized delivery match" olarak sunulur,
 * "absolute breach" DEĞİLDİR.
 */
function drawDecoyBlock(
  doc: PDFKit.PDFDocument,
  d: NonNullable<ReportInput["decoyMatch"]>,
): void {
  drawSectionTitle(doc, "Decoy Layer · Bireyselleştirilmiş Teslim İzi");
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(
      "Aynı kaynak metnin (shared core) farklı viewer'lara teslimi sırasında " +
        "her teslime kriptografik olarak benzersiz bir emission_token gömülür " +
        "(Unicode Tag, U+E0000-U+E007F). Suspect text içinde decode edilen token " +
        "DB'deki teslim kaydıyla join edilir. Bu kanıt yardımcı niteliktedir; " +
        "verdict ladder'a girmez ve tek başına suçlama temeli olmaz.",
      MARGIN,
      doc.y,
      { width: PAGE.width - MARGIN * 2 },
    );
  doc.moveDown(0.4);

  const tableW = PAGE.width - MARGIN * 2;
  const badgeY = doc.y;
  doc.save();
  doc
    .roundedRect(MARGIN, badgeY, tableW, 22, 3)
    .fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();
  const badgeLabel = d.primaryEmission
    ? d.multiEmission
      ? `MULTI-EMISSION · ${d.tokensFound} farklı teslim izi`
      : `MATCH · 1 teslim izi (viewerId=${d.primaryEmission.viewerId})`
    : d.tagCodepointCount > 0
      ? "STRIPPED · marker codepoint kalıntısı, decode edilemedi"
      : "—";
  const badgeColor = d.primaryEmission
    ? COLORS.primary
    : d.tagCodepointCount > 0
      ? COLORS.accent
      : COLORS.muted;
  doc
    .fillColor(badgeColor)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(badgeLabel, MARGIN + 10, badgeY + 6, { width: tableW - 20 });
  doc.y = badgeY + 30;

  if (d.primaryEmission) {
    const lines: Array<[string, string]> = [
      ["Primary viewerId", d.primaryEmission.viewerId],
      ["Primary clientId", d.primaryEmission.clientId],
      ["docId", d.primaryEmission.docId],
      ["Teslim zamanı", d.primaryEmission.emittedAt],
      ["Decoded token sayısı", String(d.tokensFound)],
      ["Tag codepoint", String(d.tagCodepointCount)],
    ];
    doc.fillColor(COLORS.text).font("Helvetica").fontSize(9);
    for (const [k, v] of lines) {
      const startY = doc.y;
      doc
        .fillColor(COLORS.muted)
        .font("Helvetica-Bold")
        .text(k, MARGIN + 4, startY, { width: 140, continued: false });
      doc
        .fillColor(COLORS.text)
        .font("Helvetica")
        .text(v, MARGIN + 150, startY, { width: tableW - 160 });
      doc.moveDown(0.1);
    }
  }

  if (d.otherEmissions.length > 0) {
    doc.moveDown(0.3);
    doc
      .fillColor(COLORS.text)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(`Diğer teslim izleri (${d.otherEmissions.length}):`);
    for (const e of d.otherEmissions.slice(0, 8)) {
      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8)
        .text(
          `• viewerId=${e.viewerId}  clientId=${e.clientId}  emittedAt=${e.emittedAt}`,
          MARGIN + 8,
          doc.y,
          { width: tableW - 16 },
        );
    }
  }

  if (d.unknownTokenCount > 0) {
    doc.moveDown(0.3);
    doc
      .fillColor(COLORS.accent)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(
        `⚠ ${d.unknownTokenCount} adet decode edilen token DB'de yok — ` +
          "cross-tenant frame attempt veya yetkisiz token üretimi sinyali.",
        MARGIN,
        doc.y,
        { width: tableW },
      );
  }
  doc.moveDown(0.5);
}

function drawTieredVerdictBlock(
  doc: PDFKit.PDFDocument,
  tv: NonNullable<ReportInput["tieredVerdict"]>,
): void {
  drawSectionTitle(doc, "Çoklu Kanal Bütünlük Analizi · Tiered Verdict");
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(
      "Her kanıt kanalı dayanıklılığına göre Tier'lara ayrılır: " +
        "T0 (Honeytoken — doğrudan suçüstü), T1 (Zero-Width + Homoglyph — " +
        "carrier steganografisi), T2 (Linguistic DNA — stilometrik örüntü). " +
        "Cascade Hash AUX olarak raporlanır ama karar mekanizmasına GİRMEZ. " +
        "STRONG kararı için T0=1 VEYA ≥2 T1 ≥ 0.70 VEYA (T1 ≥ 0.80 + T2 ≥ 0.70). " +
        "Margin Guard ≥ 0.20 ve Multi-suspect Demote en katı haliyle uygulanır.",
      MARGIN,
      doc.y,
      { width: PAGE.width - MARGIN * 2 },
    );
  doc.moveDown(0.5);

  const verdictColor =
    tv.verdict === "STRONG"
      ? COLORS.primary
      : tv.verdict === "AMBIGUOUS"
        ? COLORS.accent
        : COLORS.muted;
  const verdictLabel =
    tv.verdict === "STRONG"
      ? "STRONG · GÜÇLÜ TEKNİK EŞLEŞME"
      : tv.verdict === "AMBIGUOUS"
        ? "AMBIGUOUS · BELİRSİZ / ÇOKLU İZ"
        : "INSUFFICIENT · KANIT YETERSİZ";
  const tableW = PAGE.width - MARGIN * 2;
  const badgeY = doc.y;
  doc.save();
  doc.roundedRect(MARGIN, badgeY, tableW, 28, 4).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();
  doc
    .fillColor(verdictColor)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(verdictLabel, MARGIN + 12, badgeY + 8, { width: tableW - 24 });
  doc.y = badgeY + 36;

  // Per-channel table.
  const colW = [120, 50, 70, 70, 60];
  const headers = ["Kanal", "Tier", "Skor", "Decay", "Vital"];
  const rowH = 18;
  let rowY = doc.y;
  doc.save();
  doc.rect(MARGIN, rowY, tableW, rowH).fill(COLORS.border);
  doc.restore();
  let cx = MARGIN + 8;
  doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(9);
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i]!, cx, rowY + 5, { width: colW[i]! - 8 });
    cx += colW[i]!;
  }
  rowY += rowH;

  for (const ch of tv.channelProfile) {
    doc.save();
    doc.rect(MARGIN, rowY, tableW, rowH).fillAndStroke(COLORS.bg, COLORS.border);
    doc.restore();
    const vitalLabel = ch.vital ? "✓ HAYATİ" : "—";
    const vitalColor = ch.vital ? COLORS.primary : COLORS.muted;
    const tierLabel = ch.tier === "AUX" ? "AUX" : ch.tier;
    const presentLabel = ch.present
      ? `${(ch.score * 100).toFixed(1)}%`
      : "yok";
    const cells: Array<[string, string]> = [
      [ch.name, COLORS.text],
      [tierLabel, ch.tier === "AUX" ? COLORS.muted : COLORS.text],
      [presentLabel, ch.present ? COLORS.text : COLORS.muted],
      [`${(ch.decay * 100).toFixed(1)}%`, COLORS.muted],
      [vitalLabel, vitalColor],
    ];
    cx = MARGIN + 8;
    for (let i = 0; i < cells.length; i++) {
      doc.fillColor(cells[i]![1]).font("Helvetica").fontSize(9);
      doc.text(cells[i]![0], cx, rowY + 5, { width: colW[i]! - 8 });
      cx += colW[i]!;
    }
    rowY += rowH;
  }
  doc.y = rowY + 8;

  // Reasons list.
  if (tv.reasons.length > 0) {
    doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(9).text("Karar Gerekçeleri:");
    doc.moveDown(0.2);
    for (const r of tv.reasons) {
      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8)
        .text(`• ${r}`, MARGIN + 8, doc.y, { width: tableW - 16 });
    }
  }

  // Attribution + guard footnotes.
  const attrLine =
    tv.attributedClientIds.length === 0
      ? "—"
      : tv.attributedClientIds.slice(0, 6).map((c) => `#${c}`).join(", ") +
        (tv.attributedClientIds.length > 6 ? ", …" : "");
  drawKeyValueRow(doc, [
    ["Atfedilen Müşteri(ler)", attrLine],
    ["STRONG eşiği geçen aday", String(tv.strongCandidateCount)],
    ["Margin Guard", tv.marginGuardDemoted ? "DEMOTED (margin < 0.20)" : "OK"],
    ["Multi-suspect Demote", tv.multiSuspectDemoted ? "DEMOTED" : "—"],
    ["Margin (best − runner-up)", tv.margin === null ? "—" : tv.margin.toFixed(3)],
  ]);
}

export async function generateForensicReport(input: ReportInput): Promise<GeneratedReport> {
  const { default: PDFDocument } = await import("pdfkit");
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: MARGIN,
        info: {
          Title: "TancMark Forensic Report",
          Author: "TancMark",
          Subject: "Multi-Channel Forensic Attribution",
          Creator: "TancMark core",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const sha256 = createHash("sha256").update(buffer).digest("hex");
        resolve({ buffer, sha256, byteLength: buffer.length });
      });
      doc.on("error", reject);

      doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.bg);

      drawHeaderBand(doc);
      doc.y = 110;
      doc.x = MARGIN;

      // ------------------------------------------------------------------
      // Page management. We track the current page number ourselves so we
      // can stamp footers (with the right page number) on each page. The
      // 'pageAdded' handler paints the dark background + header band so
      // overflow pages keep a consistent look.
      // ------------------------------------------------------------------
      let pageNum = 1;
      const FOOTER_LABEL = "Confidential — Forensic Evidence";
      const FOOTER_Y_THRESHOLD = PAGE.height - 70;

      doc.on("pageAdded", () => {
        pageNum += 1;
        doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.bg);
        drawHeaderBand(doc);
        doc.y = 110;
        doc.x = MARGIN;
      });

      const ensureSpace = (needed: number): void => {
        if (doc.y + needed > FOOTER_Y_THRESHOLD) {
          drawFooter(doc, pageNum, FOOTER_LABEL);
          doc.addPage();
        }
      };

      // AEGIS v4.1 Step 2.5 — Advance Confidence Fix.
      // Vault (PQC) katmanı henüz aktif olmadığı için, primarySuspect
      // sağlandığında ve `matchConfidence === "preliminary"` ise raporun
      // başında gözden kaçırılamayacak bir "Ön Bulgu" uyarı bandı çizilir.
      // Bant okuyucuya raporun "Vault-confirmed" değil "preliminary"
      // (ön bulgu) seviyesinde olduğunu hatırlatır; tek başına suçlama
      // temeli değildir. Vault devreye alındığında bu blok yalnızca
      // matchConfidence "preliminary" olduğunda görünmeye devam eder.
      if (
        input.primarySuspect &&
        input.primarySuspect.matchConfidence === "preliminary"
      ) {
        const bannerH = 46;
        const bannerY = doc.y;
        const bannerW = PAGE.width - MARGIN * 2;
        doc.save();
        doc
          .roundedRect(MARGIN, bannerY, bannerW, bannerH, 4)
          .fillAndStroke(COLORS.panel, COLORS.accent);
        doc.restore();
        doc
          .fillColor(COLORS.accent)
          .font("Helvetica-Bold")
          .fontSize(11)
          .text(
            "ÖN BULGU · matchConfidence = preliminary",
            MARGIN + 12,
            bannerY + 6,
            { width: bannerW - 24 },
          );
        doc
          .fillColor(COLORS.muted)
          .font("Helvetica")
          .fontSize(8)
          .text(
            "Bu rapor Vault (PQC) doğrulaması olmadan üretilmiştir. " +
              "Bulgular yardımcı kanıt niteliğindedir; tek başına kesin " +
              "suçlama temeli oluşturmaz. Vault katmanı (Step 3) devreye " +
              "alındıktan sonra `vault-confirmed` üst kademesine yükseltilebilir.",
            MARGIN + 12,
            bannerY + 24,
            { width: bannerW - 24 },
          );
        doc.y = bannerY + bannerH + 8;
      }

      drawSectionTitle(doc, "Olay Özeti");
      const verdict = classifyVerdict(input);
      let suspectedLabel: string;
      if (verdict.level === "strong") {
        suspectedLabel = `Müşteri #${verdict.clientId}`;
      } else if (verdict.level === "ambiguous") {
        const list = verdict.clients
          .slice(0, 4)
          .map((c) => `#${c}`)
          .join(", ");
        suspectedLabel = `Çoklu iz: ${list}${verdict.clients.length > 4 ? ", …" : ""}`;
      } else {
        suspectedLabel = "Tespit edilemedi";
      }
      drawKeyValueRow(doc, [
        ["Sonuç", verdict.label],
        ["Şüpheli Müşteri", suspectedLabel],
        ["Birleşik Skor (proximity)", pctText(input.confidenceScore)],
        ["Linguistic Token", `${input.matchedTokens} / ${input.totalTokens}`],
        ["Talep Eden IP", input.ip],
        ["Talep Eden Kullanıcı", input.userId ?? "—"],
        ["Üretim Zamanı", fmtTimestamp(input.generatedAt)],
      ]);

      // Section: Çok Kanallı Yedekli Atıf (Multi-channel Redundant Attribution)
      if (input.channelBreakdown) {
        drawSectionTitle(doc, "Çok Kanallı Yedekli Atıf · Multi-channel Redundant Attribution");
        doc
          .fillColor(COLORS.muted)
          .font("Helvetica")
          .fontSize(8)
          .text(
            "Üç bağımsız kanaldan elde edilen tespit sonuçları (Linguistic DNA, " +
              "Homoglyph, Zero-Width). Birleşik skor: 0.5 × Linguistic + 0.3 × " +
              "Homoglyph + 0.2 × Zero-Width. Bir kanal silinse dahi diğerleri " +
              "üzerinden atıf yapılabilmesi için yedekli (redundant) tasarlanmıştır.",
            MARGIN,
            doc.y,
            { width: PAGE.width - MARGIN * 2 },
          );
        doc.moveDown(0.5);
        drawSignatureInventory(doc, input.channelBreakdown);
      }

      // Section: Yasal Zaman Damgası (OpenTimestamps / Bitcoin)
      if (input.timestamp) {
        ensureSpace(120);
        drawTimestampBlock(doc, input.timestamp);
      }

      // Section: Yapısal Bütünlük Analizi (AEGIS v4.0 Faz 2 — Cascade Hash)
      if (input.cascadeIntegrity) {
        ensureSpace(160);
        drawCascadeIntegrityBlock(doc, input.cascadeIntegrity);
      }

      // Section: Çoklu Kanal Bütünlük Analizi (AEGIS v4.0 Faz 3 — Tiered Verdict)
      if (input.tieredVerdict) {
        ensureSpace(200);
        drawTieredVerdictBlock(doc, input.tieredVerdict);
      }

      // Section: Decoy Layer (AEGIS v4.1 Step 2 — Individualized Emission)
      if (input.decoyMatch) {
        ensureSpace(160);
        drawDecoyBlock(doc, input.decoyMatch);
      }

      if (input.candidates && input.candidates.length > 0) {
        drawSectionTitle(doc, "Aday Sıralaması");
        const top = input.candidates.slice(0, 5);
        for (let i = 0; i < top.length; i++) {
          const c = top[i]!;
          const startY = doc.y;
          doc.save();
          doc.roundedRect(MARGIN, startY, PAGE.width - MARGIN * 2, 20, 3).fillAndStroke(COLORS.panel, COLORS.border);
          doc
            .fillColor(COLORS.muted)
            .font("Helvetica-Bold")
            .fontSize(9)
            .text(`#${i + 1}`, MARGIN + 8, startY + 6, { width: 20 });
          doc
            .fillColor(COLORS.text)
            .font("Helvetica")
            .fontSize(9)
            .text(`Müşteri ${c.clientId}`, MARGIN + 36, startY + 6, { width: 200 });
          doc
            .fillColor(COLORS.muted)
            .text(`${c.matchedTokens}/${c.totalTokens} token`, MARGIN + 240, startY + 6, { width: 140 });
          doc
            .fillColor(c.confidenceScore > 0.8 ? COLORS.primary : COLORS.accent)
            .font("Helvetica-Bold")
            .text(pctText(c.confidenceScore), PAGE.width - MARGIN - 70, startY + 6, {
              width: 60,
              align: "right",
            });
          doc.restore();
          doc.y = startY + 24;
        }
      }

      drawSectionTitle(doc, "Metin Karşılaştırması");
      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8)
        .text("Vurgulu kelimeler Linguistic-DNA mührüne karşılık gelir.", MARGIN, doc.y, {
          width: PAGE.width - MARGIN * 2,
        });
      doc.moveDown(0.6);

      const panelTop = doc.y;
      const panelHeight = Math.min(220, PAGE.height - panelTop - 130);
      const panelWidth = (PAGE.width - MARGIN * 2 - 12) / 2;

      const suspectTokens = tokenizeWithMarks(input.suspectText, input.protectedText);
      const refTokens = tokenizeWithMarks(input.protectedText, input.suspectText);

      drawTextPanel(doc, MARGIN, panelTop, panelWidth, panelHeight, "Sızdırılan Metin", suspectTokens, COLORS.danger);
      drawTextPanel(
        doc,
        MARGIN + panelWidth + 12,
        panelTop,
        panelWidth,
        panelHeight,
        "Orijinal (Mühürlü) Metin",
        refTokens,
        COLORS.primary,
      );

      doc.y = panelTop + panelHeight + 16;

      // Adli Mühür / Bütünlük Özeti — transport-integrity SHA-256, no
      // non-repudiation claim. The signature inventory above documents the
      // forensic evidence; this section documents the document checksum.
      drawSectionTitle(doc, "Adli Mühür / Bütünlük Özeti");
      doc
        .fillColor(COLORS.text)
        .font("Helvetica")
        .fontSize(9)
        .text(
          "Bu belge adli bilişim standartlarına uygun olarak üretilmiştir. " +
            "Belge içeriğinin değişmediği SHA-256 bütünlük özeti ile doğrulanır; " +
            "özet, yanıt başlığında (x-report-sha256) ve sunucu denetim kaydında " +
            "(Report_Generated) saklanır. Tespit edilen imzaların kanal bazlı " +
            "dağılımı yukarıdaki İmza Envanteri tablosunda yer alır.",
          MARGIN,
          doc.y,
          { width: PAGE.width - MARGIN * 2, align: "justify" },
        );

      doc.moveDown(0.6);
      doc
        .fillColor(COLORS.muted)
        .fontSize(8)
        .text("SHA-256 doğrulama özeti: yanıt başlığı x-report-sha256", MARGIN, doc.y);

      // ==================================================================
      // GELİŞMİŞ KANIT BLOKLARI (advanced evidence blocks)
      // Each is independently optional; renders only if input is present.
      // ==================================================================

      if (input.stylometry) {
        ensureSpace(190);
        drawStylometryBlock(doc, input.stylometry);
      }

      if (input.diffSummary) {
        ensureSpace(140);
        drawDiffBlock(doc, input.diffSummary);
      }

      if (input.spatialVariance) {
        ensureSpace(150);
        drawSpatialVarianceBlock(doc, input.spatialVariance);
      }

      if (input.expertNotes && input.expertNotes.length > 0) {
        drawExpertNotesBlock(doc, input.expertNotes, ensureSpace);
      }

      drawFooter(doc, pageNum, FOOTER_LABEL);

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
