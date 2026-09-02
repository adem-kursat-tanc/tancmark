import { Router } from "express";

const router = Router();

router.use((req, res) => {
  res.status(410).json({
    error: "legacy_lab_disabled_in_native_product_bundle",
    route: req.originalUrl.split("?")[0] ?? req.originalUrl,
    nativeProductPathRequired: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  });
});

export default router;
