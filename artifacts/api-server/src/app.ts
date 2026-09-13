import express, { type Express } from "express";
import cors from "cors";
import * as pinoHttpModule from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const pinoHttp = (pinoHttpModule as any).default ?? pinoHttpModule;

const app: Express = express();

app.use(
  pinoHttp({
    logger,
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
