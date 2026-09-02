/**
 * Singleton model loader for the multilingual mpnet embedding model.
 * Cold-start (ilk yükleme) maliyetini kaydeder; sonraki çağrılar cached
 * pipeline'ı kullanır.
 *
 * Model: `Xenova/paraphrase-multilingual-mpnet-base-v2` (q8 quantized,
 * ~700-800 MB RAM, 768-dim, ~14-16 ms/cümle hot inference).
 *
 * NOT: transformers.js'i devDependency olarak tutuyoruz (lib/aegis-core
 * package.json) — host process bu paketi kuruluysa pipeline yüklenir,
 * değilse `loadModel` exception fırlatır. Cloak route bu durumda semantic
 * watermark'ı atlar (skipReason raporlanır).
 */

const MODEL_ID = "Xenova/paraphrase-multilingual-mpnet-base-v2";
const MODEL_DTYPE = "q8";
const MODEL_PRODUCT_APPROVAL_ENV = "AEGIS_SEMANTIC_MODEL_PRODUCT_APPROVED";

function semanticModelProductRuntimeActive(): boolean {
  return process.env["NODE_ENV"] === "production" || process.env["AEGIS_PRODUCT_RUNTIME"] === "1";
}

function semanticModelProductApproved(): boolean {
  return process.env[MODEL_PRODUCT_APPROVAL_ENV] === "1";
}

type Extractor = (
  text: string,
  options: { pooling: "mean"; normalize: true },
) => Promise<{ data: Float32Array }>;

interface ModelState {
  extractor: Extractor;
  coldStartMs: number;
  loadedAt: number;
}

let cached: ModelState | null = null;
let pendingLoad: Promise<ModelState> | null = null;

export async function loadSemanticModel(): Promise<ModelState> {
  if (cached) return cached;
  if (pendingLoad) return pendingLoad;
  pendingLoad = (async () => {
    const productRuntime = semanticModelProductRuntimeActive();
    if (productRuntime && !semanticModelProductApproved()) {
      throw new Error(
        `semantic_model_blocked_in_product:${MODEL_ID}:` +
          `set ${MODEL_PRODUCT_APPROVAL_ENV}=1 only after model source, license, hashes and local bundle are approved`,
      );
    }
    const t0 = Date.now();
    let mod: any;
    try {
      mod = await import("@huggingface/transformers");
    } catch (err) {
      throw new Error(
        `semantic: @huggingface/transformers yüklenemedi (${(err as Error).message}). ` +
          `Cloak akışı semantic watermark'ı atlayacak.`,
      );
    }
    const { pipeline, env } = mod;
    env.allowLocalModels = productRuntime || process.env["AEGIS_SEMANTIC_MODEL_LOCAL_ONLY"] === "1";
    if (productRuntime && "allowRemoteModels" in env) {
      env.allowRemoteModels = false;
    }
    // Replit container'da .cache yazılabilir.
    env.cacheDir =
      process.env["TRANSFORMERS_CACHE"] ?? "./.cache/transformers";
    const extractor = (await pipeline("feature-extraction", MODEL_ID, {
      dtype: MODEL_DTYPE,
    })) as Extractor;
    // Warm-up — ilk inference çekirdek-init yapar.
    await extractor("Bu bir ısınma cümlesidir.", {
      pooling: "mean",
      normalize: true,
    });
    const coldStartMs = Date.now() - t0;
    cached = { extractor, coldStartMs, loadedAt: Date.now() };
    return cached;
  })();
  try {
    return await pendingLoad;
  } finally {
    pendingLoad = null;
  }
}

/** True ise model bu süreçte zaten yüklü; coldStart 0 raporlanır. */
export function isSemanticModelLoaded(): boolean {
  return cached !== null;
}

/** Test/regresyon kolaylığı için reset (üretimde çağırma). */
export function _resetSemanticModelForTests(): void {
  cached = null;
  pendingLoad = null;
}

export async function embedOne(text: string): Promise<Float32Array> {
  const { extractor } = await loadSemanticModel();
  const out = await extractor(text, { pooling: "mean", normalize: true });
  return out.data;
}

export async function embedMany(texts: string[]): Promise<Float32Array[]> {
  const { extractor } = await loadSemanticModel();
  const out: Float32Array[] = [];
  for (const t of texts) {
    const r = await extractor(t, { pooling: "mean", normalize: true });
    out.push(r.data);
  }
  return out;
}

export const SEMANTIC_MODEL_INFO = {
  modelId: MODEL_ID,
  dtype: MODEL_DTYPE,
  dim: 768,
} as const;
