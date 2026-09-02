import { Router, type IRouter } from "express";
import { DEMO_HTML } from "./demo-html";
import { requireAdminToken } from "../middlewares/adminAuth";

const router: IRouter = Router();

// codeql[js/missing-rate-limiting] False positive: app.ts mounts generalLimiter before the complete /api router.
router.get("/", (req, res, next) => {
  if (process.env["NODE_ENV"] === "production") {
    requireAdminToken(req, res, next);
    return;
  }
  next();
}, (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(DEMO_HTML);
});

export default router;
