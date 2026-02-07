import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { routes } from "./routes";
import cookieParser from "cookie-parser";
import { errorHandler } from "../common/middlewares/errorHandler";
import { errorHandlerAiRoute } from '../modules/ai/error.middleware';
import { env } from '../config/env';

export function createApp() {
  const app = express();

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


  // routes
  app.use("/api/v1", routes);

  // error handling (last)
  app.use(errorHandler);

  app.use(errorHandlerAiRoute);

  return app;
}
