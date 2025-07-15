import path from "path";
import { fileURLToPath } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

// Global server instance
let globalServer: Server | null = null;

/**
 * Set global server instance
 */
export function setGlobalServer(server: Server): void {
  globalServer = server;
}

/**
 * Get global server instance
 */
export function getGlobalServer(): Server | null {
  return globalServer;
}

/**
 * Get DATA_DIR path
 * If there is a server and listRoots is supported, use the first root starting with file:// + "/data"
 * Otherwise, use environment variables or project root directory
 */
export async function getDataDir(): Promise<string> {
  const server = getGlobalServer();
  let rootPath: string | null = null;

  if (server) {
    try {
      const roots = await server.listRoots();

      // Find the first root starting with file://
      if (roots.roots && roots.roots.length > 0) {
        const firstFileRoot = roots.roots.find((root) =>
          root.uri.startsWith("file://")
        );
        if (firstFileRoot) {
          // Extract actual path from file:// URI
          rootPath = firstFileRoot.uri.replace("file://", "");
        }
      }
    } catch (error) {
      console.error("Failed to get roots:", error);
    }
  }

  // Process process.env.DATA_DIR
  if (process.env.DATA_DIR) {
    if (path.isAbsolute(process.env.DATA_DIR)) {
      // If DATA_DIR is an absolute path, return "DATA_DIR/rootPath last folder name"
      if (rootPath) {
        const lastFolderName = path.basename(rootPath);
        return path.join(process.env.DATA_DIR, lastFolderName);
      } else {
        // If there is no rootPath, return DATA_DIR
        return process.env.DATA_DIR;
      }
    } else {
      // If DATA_DIR is a relative path, return "rootPath/DATA_DIR"
      if (rootPath) {
        return path.join(rootPath, process.env.DATA_DIR);
      } else {
        // If there is no rootPath, use PROJECT_ROOT
        return path.join(PROJECT_ROOT, process.env.DATA_DIR);
      }
    }
  }

  // If there is no DATA_DIR, use default logic
  if (rootPath) {
    return path.join(rootPath, "data");
  }

  // Finally, return to project root directory
  return path.join(PROJECT_ROOT, "data");
}

/**
 * Get task file path
 */
export async function getTasksFilePath(): Promise<string> {
  const dataDir = await getDataDir();
  return path.join(dataDir, "tasks.json");
}

/**
 * Get memory folder path
 */
export async function getMemoryDir(): Promise<string> {
  const dataDir = await getDataDir();
  return path.join(dataDir, "memory");
}

/**
 * Get WebGUI file path
 */
export async function getWebGuiFilePath(): Promise<string> {
  const dataDir = await getDataDir();
  return path.join(dataDir, "WebGUI.md");
}

/**
 * Get project root directory
 */
export function getProjectRoot(): string {
  return PROJECT_ROOT;
}
