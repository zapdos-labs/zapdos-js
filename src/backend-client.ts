import axios from "axios";
import fs from "fs";
import path from "path";
import WebSocketImpl from "ws";
import { ZapdosBaseClient } from "./base-client";
import { QueryBuilder, UnselectedQueryBuilder } from "./resource-request-builder";
import type {
  BackendClientOptions,
  Environment,
  GetUploadUrlsResult,
  JobItem,
  ObjectStorageItem,
  SearchResultItem,
  UploadCallbacksWithFileIndex,
  UploadItem,
  VideoObject,
  WebSocketOptions
} from "./types";

export class BackendZapdosClient extends ZapdosBaseClient {
  public get environment(): Environment {
    return "backend";
  }
  public readonly apiKey: string;

  // Enforce API key in constructor
  constructor(options: BackendClientOptions) {
    super(options);
    if (!options) {
      throw new Error("Missing backend client options");
    }

    if (!options.apiKey) {
      throw new Error("Missing API key");
    }

    this.apiKey = options.apiKey;
  }

  from<T>(resource: string): UnselectedQueryBuilder<T> {
    return new UnselectedQueryBuilder<T>(this.baseUrl, this.getAuthHeader(), resource);
  }

  getAuthHeader(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  // Convenient methods to query

  videos() {
    return this.from<VideoObject>("object_storage")
      .select()
      .where("metadata->>'content_type'", "~", "^video/");
  }

  images() {
    return this.from<ObjectStorageItem>("object_storage")
      .select()
      .where("metadata->>'content_type'", "~", "^image/");
  }

  jobs() {
    return this.from<JobItem>("jobs").select();
  }

  scenes(video_id: string): QueryBuilder<ObjectStorageItem> {
    return this.from<ObjectStorageItem>("object_storage")
      .select()
      .where("metadata->'parents'", "@>", `["${video_id}"]`)
      .where("metadata->>'kind'", "=", "scene");
  }

  listen(opts: WebSocketOptions) {
    // Always use ws package in backend
    const ws = new WebSocketImpl(this.wsBaseUrl, {
      headers: this.getAuthHeader(),
    });

    ws.onopen = (event: any) => {
      this.logger.log("WebSocket connected");
      opts.onOpen?.(event);
    };

    ws.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        try {
          opts.onMessage?.(data);
        } catch (error) {
          this.logger.error("Error in onMessage callback:", error);
        }
      } catch (error) {
        this.logger.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = (error: any) => {
      this.logger.error("WebSocket error:", error);
      opts.onError?.(error);
    };

    ws.onclose = (event: any) => {
      this.logger.log("WebSocket disconnected:", event.code, event.reason);
      opts.onClose?.(event);
    };

    return ws;
  }

  async getUploadUrls(quantity?: number) {
    const url = `${this.baseUrl}/v1/signed-url/put`;
    const params = { quantity };
    const headers = this.getAuthHeader();
    const response = await axios.get(url, { params, headers });
    // New format: { data: string[] }
    const result: GetUploadUrlsResult = response.data;
    return result;
  }

  /**
   * Get a single signed upload URL.
   * @returns Promise with a single URL or error
   */
  async getUploadUrl(): Promise<
    { data: string; error?: undefined } |
    { data?: undefined; error: { message: string } }
  > {
    const result = await this.getUploadUrls(1);
    if (result.error) return result; // pass through error
    if (!result.data || !result.data[0]) {
      return { error: { message: "No upload URL returned from server" } };
    }
    return { data: result.data[0] };
  }

  /**
   * Search by text using embeddings. Example:
   *   client.search("cats playing piano", { limit: 5, object_ids: ["id1", "id2"] })
   * @param text The search query
   * @param options Optional search options (e.g., { limit, object_ids })
   * @returns Promise with result type: { data, error? } | { error, data? }
   */
  async search(
    text: string,
    options?: { limit?: number; object_ids?: string[]; video_id?: string }
  ): Promise<
    { data: { items: SearchResultItem[] }; error?: undefined } |
    { data?: undefined; error: { message: string } }
  > {
    text = text.trim();
    if (!text) {
      return { error: { message: "Search text is empty" } };
    }
    const url = `${this.baseUrl}/v1/search`;
    const headers = {
      ...this.getAuthHeader(),
      "Content-Type": "application/json",
    };
    const body: any = {
      text,
    };
    if (options?.limit != null) body.limit = options.limit;
    if (options?.object_ids && Array.isArray(options.object_ids) && options.object_ids.length > 0) {
      body.object_ids = options.object_ids;
    }
    if (options?.video_id) {
      body.video_id = options.video_id;
    }
    try {
      const response = await axios.post(url, body, { headers });
      return { data: response.data.data };
    } catch (error: any) {
      return { error: { message: error?.message ?? "Search failed" } };
    }
  }

  /**
   * Get signed download URLs for object IDs.
   * @param ids Array of object IDs
   * @returns Promise with URLs and expiry, or error
   */
  async getDownloadUrls(
    ids: string[]
  ): Promise<
    { data: { urls: Record<string, string>; expires_at: string }; error?: undefined } |
    { data?: undefined; error: { message: string } }
  > {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { error: { message: "No IDs provided" } };
    }
    const url = `${this.baseUrl}/v1/signed-url/get`;
    const headers = this.getAuthHeader();
    const params = { ids: ids.join(",") };
    try {
      const response = await axios.get(url, { params, headers });
      return { data: response.data.data };
    } catch (error: any) {
      return { error: { message: error?.message ?? "Failed to get download URLs" } };
    }
  }

  /**
   * Get a single signed download URL for an object ID.
   * @param id Object ID
   * @returns Promise with a single URL or error
   */
  async getDownloadUrl(
    id: string
  ): Promise<
    { data: { url: string; expires_at: string }; error?: undefined } |
    { data?: undefined; error: { message: string } }
  > {
    const result = await this.getDownloadUrls([id]);
    if (result.error) return result; // pass through error
    const url = result.data.urls[id];
    if (!url) {
      return { error: { message: `No download URL returned for id: ${id}` } };
    }

    console.log('getDownloadUrl result:', result);
    return { data: { url, expires_at: result.data.expires_at } };
  }

  /**
   * Download a single file by object ID to a local directory or file path.
   */
  async download(
    id: string,
    dest: string
  ): Promise<
    { data: { file: string }; error?: undefined } |
    { data?: undefined; error: { message: string } }
  > {
    // If dest ends with a path separator or is a directory, treat as directory, else as file path
    const isDir = dest.endsWith(path.sep) || fs.existsSync(dest) && fs.statSync(dest).isDirectory();
    const destPath = isDir ? path.join(dest, id) : dest;
    const batch = await this.downloadBatchWithPaths([{ id, destPath }]);
    if (batch.error) return { error: batch.error };
    return { data: { file: batch.data.files[0] } };
  }

  /**
   * Download multiple files by object IDs to a local directory.
   */
  async downloadBatch(
    ids: string[],
    destDir: string
  ): Promise<
    { data: { files: string[] }; error?: undefined } |
    { data?: undefined; error: { message: string } }
  > {
    const pairs = ids.map(id => ({ id, destPath: path.join(destDir, id) }));
    return this.downloadBatchWithPaths(pairs);
  }

  /**
   * Download multiple files by object IDs to custom file paths.
   */
  private async downloadBatchWithPaths(
    pairs: { id: string; destPath: string }[]
  ): Promise<
    { data: { files: string[] }; error?: undefined } |
    { data?: undefined; error: { message: string } }
  > {
    const ids = pairs.map(p => p.id);
    const urlsResult = await this.getDownloadUrls(ids);
    if (urlsResult.error) return { error: urlsResult.error };
    const { urls } = urlsResult.data;
    const files: string[] = [];
    for (const { id, destPath } of pairs) {
      const url = urls[id];
      if (!url) continue;
      try {
        const response = await axios.get(url, { responseType: "stream" });
        await new Promise<void>((resolve, reject) => {
          const writer = fs.createWriteStream(destPath);
          response.data.pipe(writer);
          writer.on("finish", () => resolve());
          writer.on("error", reject);
        });
        files.push(destPath);
      } catch (error: any) {
        return { error: { message: `Failed to download ${id}: ${error?.message ?? "Unknown error"}` } };
      }
    }
    return { data: { files } };
  }

  /**
   * Upload a single file by file path.
   */
  async upload(
    filePath: string,
    on?: UploadCallbacksWithFileIndex
  ) {
    return this.uploadBatch([filePath], on);
  }

  /**
   * Upload multiple files by file paths.
   */
  async uploadBatch(
    filePaths: string[],
    on?: UploadCallbacksWithFileIndex
  ) {
    try {
      const getSignedUrlsResult = await this.getUploadUrls(filePaths.length);
      if (!getSignedUrlsResult.data || getSignedUrlsResult.data.length === 0) {
        throw new Error("No signed URLs returned from server");
      }
      const items: UploadItem[] = filePaths.map((filePath, index) => {
        const file = fs.statSync(filePath);
        const name = path.basename(filePath);
        if (!name) {
          throw new Error(`Invalid file path: ${filePath}`);
        }
        return {
          name,
          url: getSignedUrlsResult.data[index],
          size: file.size,
          content_type: "application/octet-stream",
          data: fs.createReadStream(filePath),
        };
      });
      return this.uploadWithSignedUrls(items, on);
    } catch (error: any) {
      this.logger.error("Error during upload:", error);
      return { error: { message: error.message || "Upload failed" } };
    }
  }
}
