import { config } from "dotenv";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { MulterError } from "multer";
import { pathToFileURL } from "node:url";
import authRoutes from "./src/routes/auth.routes.ts";
import announcementRoutes from "./src/routes/announcements.routes.ts";
import logger from "./src/logger.ts";
import { openApiDocument } from "./src/openapi.ts";

config({ path: ".env", override: true, quiet: true });

export const app = express();

app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
  }),
);

app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.header("Origin");

  if (origin && !allowedOrigins.includes(origin)) {
    res.status(403).json({
      message: "Not allowed by CORS",
    });
    return;
  }

  next();
});

app.use(
  cors({
    origin: allowedOrigins,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use("/auth", authRoutes);
app.use("/announcements", announcementRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    message: "Not found",
  });
});

app.use(
  (
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void => {
    logger.error(
      {
        err: error,
        method: req.method,
        path: req.path,
      },
      "Request failed",
    );

    if (error instanceof MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          message: "Image is too large",
        });
        return;
      }

      res.status(400).json({
        message: error.message,
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message === "Only image files are allowed"
    ) {
      res.status(400).json({
        message: error.message,
      });
      return;
    }

    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? String((error as { code: unknown }).code)
        : undefined;

    if (code === "P2025") {
      res.status(404).json({
        message: "Resource not found",
      });
      return;
    }

    if (code === "P2002") {
      res.status(409).json({
        message: "Unique constraint violation",
      });
      return;
    }

    res.status(500).json({
      message: "Internal server error",
    });
  },
);

export function startServer(port = Number(process.env.PORT ?? 3000)) {
  return app.listen(port, () => {
    logger.info(
      {
        port,
      },
      "API server started",
    );
  });
}

const isMain =
  Boolean(process.argv[1]) &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  startServer();
}