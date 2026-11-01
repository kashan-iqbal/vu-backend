import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { routes } from "./routes";
import cookieParser from "cookie-parser";
import { errorHandler } from "../common/middlewares/errorHandler";
import { globalLimiter } from "../common/middlewares/rateLimit";
import { csrfGuard } from "../common/middlewares/csrf.middleware";
import { identifyUser } from "../common/middlewares/auth.middleware";
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

  // CSRF: must run AFTER cookieParser (it keys off the session cookie) and before
  // any route that mutates state. See csrf.middleware.ts for why the session
  // cookie being SameSite=None makes this necessary.
  app.use(csrfGuard);

  // Identify the caller (verified JWT → req.authUserId) so the limiter below can
  // bucket per user rather than per IP. Must run AFTER cookieParser and BEFORE
  // globalLimiter. Not a gate — authGuard still protects each route.
  app.use(identifyUser);

  // app-wide rate-limit backstop (health checks are exempt)
  app.use(globalLimiter);

  // routes
  app.use("/api/v1", routes);

  // error handling (last)
  app.use(errorHandler);


  return app;
}
