import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { routes } from "./routes";
import cookieParser from "cookie-parser";
import { errorHandler } from "../common/middlewares/errorHandler";
import { globalLimiter } from "../common/middlewares/rateLimit";
import { env } from '../config/env';

export function createApp() {
  const app = express();

  // Trust the first proxy hop so req.ip is the real client (needed for correct
  // rate-limiting and secure cookies behind a reverse proxy / load balancer).
  app.set("trust proxy", 1);

  // security + basics
  app.use(helmet());
  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true
  }
  ));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // logs
  app.use(morgan("dev"));

  // cookie
  app.use(cookieParser());

  // app-wide rate-limit backstop (health checks are exempt)
  app.use(globalLimiter);

  // routes
  app.use("/api/v1", routes);

  // error handling (last)
  app.use(errorHandler);


  return app;
}
