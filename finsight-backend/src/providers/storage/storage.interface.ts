import type { Readable } from "node:stream";

export interface StorageProvider {
  save(key: string, data: Buffer | Uint8Array): Promise<string>;
  read(key: string): Promise<Buffer>;
  createReadStream(key: string): Readable;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
  exists(key: string): Promise<boolean>;
  getAbsolutePath(key: string): string;
}

