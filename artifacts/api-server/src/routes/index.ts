import { Router, type IRouter } from "express";
import { requireAdminToken } from "../middlewares/adminAuth";
import {
  blockDirectCanonicalVideoReaderInProduct,
  blockLegacyFfmpegLabInProduct,
} from "../middlewares/productRuntimeGuards";
import healthRouter from "./health";
import aegisRouter from "./aegis";
import demoRouter from "./demo";
import demoVisualRouter from "./demoVisual";
import visualLabRouter from "./visualLab";
import videoLabRouter from "./videoLab";
import audioLabRouter from "./audioLab";
import auditRouter from "./audit";
import forensicNotesRouter from "./forensicNotes";
import botTrapsRouter from "./botTraps";
import radarRouter from "./radar";
import timestampRouter from "./timestamp";
import entanglementRouter from "./entanglement";
import beaconRouter from "./beacon";
import distributionRouter from "./distribution";
import secureRoomRouter from "./secureRoom";
import learningRouter from "./learning";
import discoveryRouter from "./discovery";
import liveRouter from "./live";
import liveLocalProductRouter from "./liveLocalProduct";
import videoProductizationRouter from "./videoProductization";
import canonicalDnaRouter from "./canonicalDna";
import c2paRouter from "./c2pa";
import { requireVerifiedLiveTenant } from "../middlewares/liveTenantAuth";
import { requireC2paTransportBoundary } from "../middlewares/c2paTransportBoundary";

const router: IRouter = Router();
const demoRouteMiddlewares = process.env["NODE_ENV"] === "production" ? [requireAdminToken] : [];

router.use(healthRouter);
router.use("/aegis", aegisRouter);
router.use("/demo", ...demoRouteMiddlewares, demoRouter);
router.use("/demo-visual", ...demoRouteMiddlewares, demoVisualRouter);
router.use("/aegis/visual-lab", visualLabRouter);
router.use("/aegis/video-lab", blockLegacyFfmpegLabInProduct, videoLabRouter);
router.use("/aegis/audio-lab", blockLegacyFfmpegLabInProduct, audioLabRouter);
router.use("/audit", auditRouter);
router.use("/forensic-notes", forensicNotesRouter);
router.use("/bot-traps", botTrapsRouter);
router.use("/aegis/radar", radarRouter);
router.use("/aegis/timestamp", timestampRouter);
router.use("/aegis/entanglement", entanglementRouter);
router.use("/aegis/beacon", beaconRouter);
router.use("/aegis/distribution-map", distributionRouter);
router.use("/aegis/secure-room", secureRoomRouter);
router.use("/aegis/learning", learningRouter);
router.use("/aegis/dna", requireAdminToken, canonicalDnaRouter);
router.use("/tancmark/discovery", discoveryRouter);
router.use(
  "/tancmark/c2pa/v1",
  requireC2paTransportBoundary,
  requireAdminToken,
  requireVerifiedLiveTenant,
  c2paRouter,
);
router.use("/tancmark/live/local/v1", liveLocalProductRouter);
router.use("/tancmark/live", liveRouter);
router.use(
  "/aegis/video-productization",
  blockDirectCanonicalVideoReaderInProduct,
  videoProductizationRouter,
);

export default router;
