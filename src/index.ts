import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { config } from "./config";
import { swaggerSpec } from "./config/swagger";
import { logger } from "./utils/logger";
import { cache } from "./utils/cache";
import { prisma } from "./db/client";
import apiRoutes from "./routes/api.routes";
import { startScheduler } from "./scheduler";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Swagger Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Football Betting Assistant API Docs",
    customfavIcon: "⚽",
  }),
);

// Serve Swagger JSON spec
app.get("/api-docs.json", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Rate limiting
const limiter = rateLimit({
  windowMs: config.API_RATE_LIMIT_WINDOW_MS,
  max: config.API_RATE_LIMIT_MAX_REQUESTS,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(
    {
      method: req.method,
      path: req.path,
      ip: req.ip,
    },
    "Incoming request",
  );
  next();
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current health status of the API server
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 */
// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use("/api", apiRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, path: req.path }, "Unhandled error");

  res.status(500).json({
    error: "Internal Server Error",
    message:
      config.NODE_ENV === "development" ? err.message : "An error occurred",
  });
});

// Start server
async function start() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info("Database connected");

    // Start scheduler
    startScheduler();
    logger.info("Scheduler started");

    // Start server
    app.listen(config.PORT, () => {
      logger.info(
        {
          port: config.PORT,
          env: config.NODE_ENV,
        },
        "Server started successfully",
      );

      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ⚽ Football Betting Assistant API                      ║
║                                                           ║
║   Server running on: http://localhost:${config.PORT}            ║
║   API Docs: http://localhost:${config.PORT}/api-docs          ║
║   Environment: ${config.NODE_ENV.toUpperCase().padEnd(11)}                       ║
║                                                           ║
║   Endpoints:                                              ║
║   • GET  /health                                          ║
║   • GET  /api-docs (Swagger UI)                          ║
║   • GET  /api/predictions/weekend                        ║
║   • GET  /api/predictions/:matchId                       ║
║   • GET  /api/matches/upcoming                           ║
║   • POST /api/data/refresh                               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  await prisma.$disconnect();
  await cache.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  await prisma.$disconnect();
  await cache.disconnect();
  process.exit(0);
});

start();

export default app;
