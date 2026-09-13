import { Router, type IRouter } from "express";
import healthRouter from "./health";
import metrifyRouter from "./metrify";

const router: IRouter = Router();

router.use(healthRouter);
router.use(metrifyRouter);

export default router;
