import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Worker } from "tesseract.js";
import { logger } from "./logger";

export const OCR_LANGUAGE_DATA_DECISION_ROLE =
  "ocr_language_data_product_gate_support_only_no_vault_no_confirmed" as const;

export type OcrResult = {
  text: string;
  confidence: number;
  durationMs: number;
  langs: string;
  bytes: number;
};

type OcrLanguage = "eng" | "tur";

type OcrLanguagePin = {
  language: OcrLanguage;
  fileName: `${OcrLanguage}.traineddata`;
  sourceUrl: string;
  license: "Apache-2.0";
  commercialUseAllowed: true;
  sha256: string;
  sizeBytes: number;
};

export type OcrLanguageDataProductGate = {
  langs: string;
  langPath: string | null;
  productMode: boolean;
  productReady: boolean;
  officialPinnedFilesOnly: true;
  networkAutoDownloadApprovedForProduct: false;
  oldLocalLabFilesProductApproved: false;
  missingLanguages: string[];
  unsupportedLanguages: string[];
  hashMismatches: string[];
  checkedFiles: Array<{
    language: OcrLanguage;
    fileName: string;
    exists: boolean;
    sizeBytes: number | null;
    sha256: string | null;
    expectedSha256: string;
    productApproved: boolean;
  }>;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof OCR_LANGUAGE_DATA_DECISION_ROLE;
};

let workerPromise: Promise<Worker> | null = null;

const DEFAULT_LANGS = process.env.AEGIS_OCR_LANGS ?? "tur+eng";
const OCR_PRODUCT_MODE =
  process.env.AEGIS_OCR_PRODUCT_MODE === "1" ||
  process.env.NODE_ENV === "production";
const CACHE_PATH =
  process.env.AEGIS_OCR_CACHE_PATH ?? "/tmp/aegis-tessdata";
const BUNDLED_LANG_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "runtime",
  "tessdata",
);
const LANG_PATH =
  process.env.AEGIS_OCR_LANG_PATH ??
  (fs.existsSync(BUNDLED_LANG_PATH) ? BUNDLED_LANG_PATH : undefined);
const LANG_PATH_GZIP =
  process.env.AEGIS_OCR_LANG_GZIP === "1"
    ? true
    : process.env.AEGIS_OCR_LANG_GZIP === "0"
      ? false
      : LANG_PATH
        ? false
        : true;

const OFFICIAL_LANGUAGE_PINS: Record<OcrLanguage, OcrLanguagePin> = {
  eng: {
    language: "eng",
    fileName: "eng.traineddata",
    sourceUrl:
      "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata",
    license: "Apache-2.0",
    commercialUseAllowed: true,
    sha256:
      "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2",
    sizeBytes: 4_113_088,
  },
  tur: {
    language: "tur",
    fileName: "tur.traineddata",
    sourceUrl:
      "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/tur.traineddata",
    license: "Apache-2.0",
    commercialUseAllowed: true,
    sha256:
      "7393381111e1152420fc4092cb44eef4237580d21b92bf30d7d221aad192c6b7",
    sizeBytes: 4_550_554,
  },
};

function parseLanguages(langs: string): string[] {
  return langs
    .split(/[+,\s]+/g)
    .map((lang) => lang.trim().toLowerCase())
    .filter((lang) => lang.length > 0);
}

function sha256File(filePath: string): string {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

export function getOcrLanguageDataProductGate(
  options: {
    langs?: string;
    langPath?: string | null;
    productMode?: boolean;
  } = {},
): OcrLanguageDataProductGate {
  const langs = options.langs ?? DEFAULT_LANGS;
  const langPath = options.langPath ?? LANG_PATH ?? null;
  const productMode = options.productMode ?? OCR_PRODUCT_MODE;
  const requested = parseLanguages(langs);
  const missingLanguages: string[] = [];
  const unsupportedLanguages: string[] = [];
  const hashMismatches: string[] = [];
  const checkedFiles: OcrLanguageDataProductGate["checkedFiles"] = [];

  for (const requestedLang of requested) {
    if (!(requestedLang in OFFICIAL_LANGUAGE_PINS)) {
      unsupportedLanguages.push(requestedLang);
      continue;
    }
    const lang = requestedLang as OcrLanguage;
    const pin = OFFICIAL_LANGUAGE_PINS[lang];
    const filePath = langPath ? path.join(langPath, pin.fileName) : "";
    const exists = Boolean(langPath && fs.existsSync(filePath));
    let sizeBytes: number | null = null;
    let sha256: string | null = null;
    if (exists) {
      const stat = fs.statSync(filePath);
      sizeBytes = stat.size;
      sha256 = sha256File(filePath);
    } else {
      missingLanguages.push(lang);
    }
    const productApproved =
      exists && sizeBytes === pin.sizeBytes && sha256 === pin.sha256;
    if (exists && !productApproved) hashMismatches.push(lang);
    checkedFiles.push({
      language: lang,
      fileName: pin.fileName,
      exists,
      sizeBytes,
      sha256,
      expectedSha256: pin.sha256,
      productApproved,
    });
  }

  const productReady =
    Boolean(langPath) &&
    requested.length > 0 &&
    unsupportedLanguages.length === 0 &&
    missingLanguages.length === 0 &&
    hashMismatches.length === 0 &&
    checkedFiles.every((file) => file.productApproved);

  return {
    langs,
    langPath,
    productMode,
    productReady,
    officialPinnedFilesOnly: true,
    networkAutoDownloadApprovedForProduct: false,
    oldLocalLabFilesProductApproved: false,
    missingLanguages,
    unsupportedLanguages,
    hashMismatches,
    checkedFiles,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: OCR_LANGUAGE_DATA_DECISION_ROLE,
  };
}

function assertOcrProductLanguageGate(): OcrLanguageDataProductGate {
  const gate = getOcrLanguageDataProductGate();
  if (gate.productMode && !gate.productReady) {
    throw new Error(
      `ocr_product_language_gate_failed:${[
        gate.langPath ? "lang_path_checked" : "missing_lang_path",
        gate.missingLanguages.length
          ? `missing=${gate.missingLanguages.join("+")}`
          : "",
        gate.unsupportedLanguages.length
          ? `unsupported=${gate.unsupportedLanguages.join("+")}`
          : "",
        gate.hashMismatches.length
          ? `hash_mismatch=${gate.hashMismatches.join("+")}`
          : "",
      ]
        .filter(Boolean)
        .join(";")}`,
    );
  }
  return gate;
}

async function getWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const { createWorker } = await import("tesseract.js");
    const t0 = Date.now();
    const languageGate = assertOcrProductLanguageGate();
    const workerOpts: Record<string, unknown> = {
      logger: () => undefined,
      cachePath: CACHE_PATH,
      cacheMethod: LANG_PATH ? "readOnly" : "readWrite",
      gzip: LANG_PATH_GZIP,
    };
    if (LANG_PATH) workerOpts.langPath = LANG_PATH;
    const worker = await createWorker(
      DEFAULT_LANGS,
      undefined,
      workerOpts as never,
    );
    logger.info(
      {
        langs: DEFAULT_LANGS,
        coldStartMs: Date.now() - t0,
        cachePath: CACHE_PATH,
        langPath: LANG_PATH ?? "default",
        languageGateProductReady: languageGate.productReady,
        languageGateProductMode: languageGate.productMode,
        languageGateDecisionRole: languageGate.decisionRole,
      },
      "ocr_worker_initialized",
    );
    return worker;
  })();
  return workerPromise;
}

export async function extractTextFromImage(
  buffer: Buffer | Uint8Array,
): Promise<OcrResult> {
  const worker = await getWorker();
  const t0 = Date.now();
  const buf =
    buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  let data: Awaited<ReturnType<Worker["recognize"]>>["data"];
  try {
    ({ data } = await worker.recognize(buf));
  } catch (err) {
    logger.warn({ err }, "ocr_worker_recognize_failed");
    await shutdownOcrWorker();
    throw err;
  }
  return {
    text: (data.text ?? "").trim(),
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
    durationMs: Date.now() - t0,
    langs: DEFAULT_LANGS,
    bytes: buf.byteLength,
  };
}

export async function shutdownOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  try {
    const w = await workerPromise;
    await w.terminate();
  } catch {
  }
  workerPromise = null;
}
