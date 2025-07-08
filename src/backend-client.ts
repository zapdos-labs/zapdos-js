import axios from "axios";
import fs from "fs";
import path from "path";
import WebSocketImpl from "ws";
import { ZapdosBaseClient } from "./base-client";
import { ResourceRequestBuilderWithSelect } from "./resource-request-builder";
import type {
  BackendClientOptions,
  Environment,
  GetUploadUrlsResult,
  JobsResponse,
  ObjectStorageResponse,
  UploadCallbacksWithFileIndex,
  UploadItem,
  WebSocketOptions,
} from "./types";

export class BackendZapdosClient extends ZapdosBaseClient {
  public get environment(): Environment {
    return "backend";
  }
  public readonly apiKey: string;

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

  from<T = any>(resource: string): ResourceRequestBuilderWithSelect<T> {
    return new ResourceRequestBuilderWithSelect<T>(this.baseUrl, this.getAuthHeader(), resource);
  }

  getAuthHeader(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  // Convenient methods to query
  videos() {
    return this.from<ObjectStorageResponse>("object_storage")
      .select()
      .where("metadata->>'content_type'", "~", "^video/");
  }

  images() {
    return this.from<ObjectStorageResponse>("object_storage")
      .select()
      .where("metadata->>'content_type'", "~", "^image/");
  }

  jobs() {
    return this.from<JobsResponse>("jobs").select();
  }

  listen(opts: WebSocketOptions) {
    // Always use ws package in backend
    const ws = new WebSocketImpl(this.wsBaseUrl, {
      headers: this.getAuthHeader(),
    });

    ws.onopen = (event: any) => {
      console.log("WebSocket connected");
      opts.onOpen?.(event);
    };

    ws.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        try {
          opts.onMessage?.(data);
        } catch (error) {
          console.error("Error in onMessage callback:", error);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = (error: any) => {
      console.error("WebSocket error:", error);
      opts.onError?.(error);
    };

    ws.onclose = (event: any) => {
      console.log("WebSocket disconnected:", event.code, event.reason);
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

  public async upload(
    filePaths: string | string[],
    on?: UploadCallbacksWithFileIndex
  ) {
    try {
      const fileArray = Array.isArray(filePaths) ? filePaths : [filePaths];
      const getSignedUrlsResult = await this.getUploadUrls(fileArray.length);
      if (!getSignedUrlsResult.data || getSignedUrlsResult.data.length === 0) {
        throw new Error("No signed URLs returned from server");
      }

      const items: UploadItem[] = fileArray.map((filePath, index) => {
        const file = fs.statSync(filePath);

        const name = path.basename(filePath);
        if (!name) {
          throw new Error(`Invalid file path: ${filePath}`);
        }
        return {
          name,
          url: getSignedUrlsResult.data[index],
          size: file.size,
          content_type: "application/octet-stream", // Default content type
          data: fs.createReadStream(filePath),
        };
      });
      return this.uploadWithSignedUrls(items, on);
    } catch (error: any) {
      console.error("Error during upload:", error);
      return { error: { message: error.message || "Upload failed" } };
    }
  }
}
