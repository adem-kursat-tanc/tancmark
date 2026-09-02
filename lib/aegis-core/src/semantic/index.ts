/**
 * AEGIS v4.0 Faz 4 — Semantic Positional Watermarking, public surface.
 *
 * Not: Bu modül `@huggingface/transformers` peer'ına bağımlıdır. Loader
 * (`model.ts`) çağrı anında dinamik import yapar; package eksikse cloak
 * route bunu yakalayıp watermark'ı atlar.
 */

export * from "./types.js";
export {
  embedSemanticPositional,
  splitSentencesTr,
  COVERAGE_THRESHOLD,
  N_BUCKETS,
} from "./embed.js";
export { verifySemanticPositional } from "./verify.js";
export {
  loadSemanticModel,
  isSemanticModelLoaded,
  _resetSemanticModelForTests,
  SEMANTIC_MODEL_INFO,
} from "./model.js";
export { SEMANTIC_OPERATORS, generateSemanticVariants } from "./perturb.js";
export {
  projectionDirection,
  targetBitFor,
} from "./projection.js";
