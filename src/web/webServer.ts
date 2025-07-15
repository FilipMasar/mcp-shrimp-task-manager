import express, { Request, Response } from "express";
import getPort from "get-port";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import { fileURLToPath } from "url";
import {
  getDataDir,
  getTasksFilePath,
  getWebGuiFilePath,
} from "../utils/paths.js";

export async function createWebServer() {
  // Create Express application
  const app = express();

  // Store SSE client list
  let sseClients: Response[] = [];

  // Send SSE event helper function
  function sendSseUpdate() {
    sseClients.forEach((client) => {
      // Check if client is still connected
      if (!client.writableEnded) {
        client.write(
          `event: update\ndata: ${JSON.stringify({
            timestamp: Date.now(),
          })}\n\n`
        );
      }
    });
    // Clean up disconnected clients (optional, but recommended)
    sseClients = sseClients.filter((client) => !client.writableEnded);
  }

  // Set static file directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const publicPath = path.join(__dirname, "..", "..", "src", "public");
  const TASKS_FILE_PATH = await getTasksFilePath(); // Use tool function to get file path

  app.use(express.static(publicPath));

  // Set API routes
  app.get("/api/tasks", async (req: Request, res: Response) => {
    try {
      // Use fsPromises to keep asynchronous reading
      const tasksData = await fsPromises.readFile(TASKS_FILE_PATH, "utf-8");
      res.json(JSON.parse(tasksData));
    } catch (error) {
      // Ensure file does not exist and return empty task list
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        res.json({ tasks: [] });
      } else {
        res.status(500).json({ error: "Failed to read tasks data" });
      }
    }
  });

  // Add: SSE endpoint
  app.get("/api/tasks/stream", (req: Request, res: Response) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      // Optional: CORS header, if frontend and backend are not in the same origin
      // "Access-Control-Allow-Origin": "*",
    });

    // Send an initial event or keep connection
    res.write("data: connected\n\n");

    // Add client to list
    sseClients.push(res);

    // Remove client from list when disconnected
    req.on("close", () => {
      sseClients = sseClients.filter((client) => client !== res);
    });
  });

  // Define writeWebGuiFile function
  async function writeWebGuiFile(port: number | string) {
    try {
      // Read TEMPLATES_USE environment variable and convert to language code
      const templatesUse = process.env.TEMPLATES_USE || "en";
      const getLanguageFromTemplate = (template: string): string => {
        if (template === "zh") return "zh-TW";
        if (template === "en") return "en";
        // Custom template default uses English
        return "en";
      };
      const language = getLanguageFromTemplate(templatesUse);

      const websiteUrl = `[Task Manager UI](http://localhost:${port}?lang=${language})`;
      const websiteFilePath = await getWebGuiFilePath();
      const DATA_DIR = await getDataDir();
      try {
        await fsPromises.access(DATA_DIR);
      } catch (error) {
        await fsPromises.mkdir(DATA_DIR, { recursive: true });
      }
      await fsPromises.writeFile(websiteFilePath, websiteUrl, "utf-8");
    } catch (error) {}
  }

  return {
    app,
    sendSseUpdate,
    async startServer() {
      // Get available port
      const port = process.env.WEB_PORT || (await getPort());

      // Start HTTP server
      const httpServer = app.listen(port, () => {
        // Start listening for file changes after server starts
        try {
          // Check if file exists, if not, do not listen (avoid watch error)
          if (fs.existsSync(TASKS_FILE_PATH)) {
            fs.watch(TASKS_FILE_PATH, (eventType, filename) => {
              if (
                filename &&
                (eventType === "change" || eventType === "rename")
              ) {
                // Delay sending to prevent multiple triggers within a short time (e.g. editor save)
                // debounce sendSseUpdate if needed
                sendSseUpdate();
              }
            });
          }
        } catch (watchError) {}

        // Write URL to WebGUI.md
        writeWebGuiFile(port).catch((error) => {});
      });

      // Set process termination event handling (ensure removing watcher)
      const shutdownHandler = async () => {
        // Close all SSE connections
        sseClients.forEach((client) => client.end());
        sseClients = [];

        // Close HTTP server
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      };

      process.on("SIGINT", shutdownHandler);
      process.on("SIGTERM", shutdownHandler);

      return httpServer;
    },
  };
}
