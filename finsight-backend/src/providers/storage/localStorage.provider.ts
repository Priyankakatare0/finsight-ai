import fs from "node:fs";
import path from "node:path";
import { type Readable } from "node:stream";
import type { StorageProvider } from "./storage.interface";

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), "uploads");
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  getAbsolutePath(key: string): string {
    // Prevent directory traversal attacks
    const safeKey = key.replace(/^(\.\.(\/|\\|$))+/, "");
    return path.resolve(this.baseDir, safeKey);
  }

  async save(key: string, data: Buffer | Uint8Array): Promise<string> {
    const fullPath = this.getAbsolutePath(key);
    const dir = path.dirname(fullPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, data);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    const fullPath = this.getAbsolutePath(key);
    return await fs.promises.readFile(fullPath);
  }

  createReadStream(key: string): Readable {
    const fullPath = this.getAbsolutePath(key);
    return fs.createReadStream(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getAbsolutePath(key);
    try {
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    } catch (error) {
      console.warn(`Failed to delete file at ${fullPath}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.getAbsolutePath(key);
    try {
      await fs.promises.access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(key: string): Promise<string> {
    // Relative API download endpoint for local files
    return `/documents/${key}/file`;
  }
}

export const localStorageProvider = new LocalStorageProvider();
export default localStorageProvider;

