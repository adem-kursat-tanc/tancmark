import { Router } from "express";

const router = Router();

router.use((req, res) => {
  res.status(410).json({
    error: "canonical_video_reader_internal_live_only",
    route: req.originalUrl.split("?")[0] ?? req.originalUrl,
    ownership: false,
    vault: false,
    confirmed: false,
    final: false,
  });
});

export default router;
