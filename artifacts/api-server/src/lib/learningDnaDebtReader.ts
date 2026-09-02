import fs from "node:fs";
import path from "node:path";
import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
  type LearningDnaRiskLevel,
} from "./learningDnaEventSchema";

export const LEARNING_DNA_DEBT_READER_VERSION = "learning-dna-debt-reader-v0.1" as const;

export type LearningDnaDebtTopic =
  | "learning_dna"
  | "chief_brain"
  | "weekly_intelligence"
  | "pricing"
  | "cost_margin";

export type LearningDnaDebtStatus = "open" | "closed" | "deferred" | "support_only" | "unknown";

export interface LearningDnaDebtItem {
  debtId: string;
  heading: string;
  topic: LearningDnaDebtTopic;
  status: LearningDnaDebtStatus;
  riskLevel: LearningDnaRiskLevel;
  summary: string;
  matchedKeywords: string[];
  source: string;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  canAutoModifyFiles: false;
  requiresHumanApprovalForHighRisk: true;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
}

export interface LearningDnaDebtReaderReport {
  status: "learning_dna_debt_reader_report_only_v0.1";
  readerVersion: typeof LEARNING_DNA_DEBT_READER_VERSION;
  generatedAt: string;
  sourcePath: string;
  debtCount: number;
  openDebtCount: number;
  deferredDebtCount: number;
  highRiskDebtCount: number;
  items: LearningDnaDebtItem[];
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  canAutoModifyFiles: false;
  productBehaviorChanged: false;
  safety: LearningDnaDecisionSafety;
  note: string;
}

interface DebtSection {
  heading: string;
  body: string;
}

const TOPIC_KEYWORDS: Record<LearningDnaDebtTopic, string[]> = {
  learning_dna: ["learning dna", "ogrenen dna", "dna registry", "dna event", "support-only recommendation"],
  chief_brain: ["chief brain", "root dna", "dry-run", "dry run", "approve_chief_brain_safe_action"],
  weekly_intelligence: ["weekly intelligence", "intelligence library"],
  pricing: ["pricing", "fiyat", "price"],
  cost_margin: ["cost", "margin", "maliyet"],
};

function defaultLedgerPath(): string {
  return path.resolve(process.cwd(), "docs", "TANCMARK_DEFERRED_WORK_LEDGER.md");
}

function cleanLine(value: string, maxLength = 260): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "debt";
}

function splitSections(text: string): DebtSection[] {
  const lines = text.split(/\r?\n/);
  const sections: DebtSection[] = [];
  let current: DebtSection | null = null;

  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      if (current) sections.push(current);
      current = {
        heading: cleanLine(line.replace(/^#{1,3}\s+/, "")),
        body: "",
      };
      continue;
    }
    if (current) current.body += `${line}\n`;
  }

  if (current) sections.push(current);
  return sections;
}

function topicMatches(sectionText: string): { topic: LearningDnaDebtTopic; keywords: string[] }[] {
  const lower = sectionText.toLowerCase();
  return Object.entries(TOPIC_KEYWORDS)
    .map(([topic, keywords]) => ({
      topic: topic as LearningDnaDebtTopic,
      keywords: keywords.filter((keyword) => lower.includes(keyword)),
    }))
    .filter((item) => item.keywords.length > 0);
}

function inferStatus(sectionText: string): LearningDnaDebtStatus {
  const lower = sectionText.toLowerCase();
  if (lower.includes("still deferred") || lower.includes("deferred") || lower.includes("pending")) {
    return "deferred";
  }
  if (lower.includes("still open") || lower.includes("open debt") || lower.includes("kalan")) {
    return "open";
  }
  if (lower.includes("support-only") || lower.includes("support only")) return "support_only";
  if (lower.includes("completed") || lower.includes("closed") || lower.includes("tamamlandi")) {
    return "closed";
  }
  return "unknown";
}

function inferRisk(sectionText: string, status: LearningDnaDebtStatus): LearningDnaRiskLevel {
  const lower = sectionText.toLowerCase();
  if (
    lower.includes("vault") ||
    lower.includes("final") ||
    lower.includes("threshold") ||
    lower.includes("ownership") ||
    lower.includes("pre-seal") ||
    lower.includes("high-risk")
  ) {
    return "high";
  }
  if (status === "open" || status === "deferred" || lower.includes("product-ready: no")) return "medium";
  return "low";
}

function firstUsefulLine(body: string): string {
  const line = body
    .split(/\r?\n/)
    .map((item) => cleanLine(item.replace(/^[-*]\s+/, "")))
    .find((item) => item.length > 0);
  return line ?? "Learning DNA related ledger item.";
}

export function extractLearningDnaDebts(
  ledgerText: string,
  sourcePath = "docs/TANCMARK_DEFERRED_WORK_LEDGER.md",
): LearningDnaDebtReaderReport {
  const items: LearningDnaDebtItem[] = [];
  const sections = splitSections(ledgerText);
  for (const section of sections) {
    const sectionText = `${section.heading}\n${section.body}`;
    const matches = topicMatches(sectionText);
    if (matches.length === 0) continue;

    const status = inferStatus(sectionText);
    const riskLevel = inferRisk(sectionText, status);
    for (const match of matches) {
      items.push({
        debtId: `debt-${slug(match.topic)}-${slug(section.heading)}`,
        heading: section.heading,
        topic: match.topic,
        status,
        riskLevel,
        summary: firstUsefulLine(section.body),
        matchedKeywords: match.keywords,
        source: sourcePath,
        canOpenVault: false,
        canConfirmFinal: false,
        canChangeThreshold: false,
        canChangeOwnership: false,
        canAutoModifyFiles: false,
        requiresHumanApprovalForHighRisk: true,
        approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
      });
    }
  }

  return {
    status: "learning_dna_debt_reader_report_only_v0.1",
    readerVersion: LEARNING_DNA_DEBT_READER_VERSION,
    generatedAt: new Date().toISOString(),
    sourcePath,
    debtCount: items.length,
    openDebtCount: items.filter((item) => item.status === "open" || item.status === "deferred").length,
    deferredDebtCount: items.filter((item) => item.status === "deferred").length,
    highRiskDebtCount: items.filter((item) => item.riskLevel === "high").length,
    items,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    canAutoModifyFiles: false,
    productBehaviorChanged: false,
    safety: learningDnaDecisionSafety(),
    note:
      "Debt reader is report-only. It reads the deferred ledger and returns Learning DNA / Chief Brain related items without editing files or changing product behavior.",
  };
}

export function readLearningDnaDebtLedger(ledgerPath = defaultLedgerPath()): LearningDnaDebtReaderReport {
  const text = fs.readFileSync(ledgerPath, "utf8");
  return extractLearningDnaDebts(text, ledgerPath);
}
