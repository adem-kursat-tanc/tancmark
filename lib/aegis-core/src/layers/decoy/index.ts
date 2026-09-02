export {
  TAG_BLOCK_START,
  TAG_BLOCK_END,
  TAG_SENTINEL,
  TAG_DATA_LENGTH,
  TAG_BLOCK_LENGTH,
  encodeEmissionToken,
  isTagCodepoint,
  stripTagCodepoints,
  scanForEmissionTokens,
  type DecodeScanResult,
} from "./tokenCodec";

export {
  generateEmissionToken,
  type EmissionTokenInput,
  type EmissionTokenOutput,
} from "./emissionToken";

export {
  distributeMarkers,
  MIN_MARKERS,
  TARGET_BYTES_PER_MARKER,
  type DistributeMarkersInput,
  type DistributeMarkersOutput,
} from "./markerDistribution";
