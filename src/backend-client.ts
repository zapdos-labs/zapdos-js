import axios from "axios";
import fs from "fs";
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
  WebSocketOptions,
} from "./types";
import { batchUpload } from "./utils";

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
    return new ResourceRequestBuilderWithSelect<T>(this, resource);
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

  /**
   * Upload one or multiple files from server using API key
   */
  public async upload(
    files: string | string[],
    on?: UploadCallbacksWithFileIndex,
  ) {
    const fileArray = Array.isArray(files) ? files : [files];
    const items = fileArray.map(f => {
      const data = fs.createReadStream(f);
      return {
        data,
        url: `${this.baseUrl}/v1/storage/upload`,
        afterFileData: async () => {
          // Optionally, you can add any post-upload logic here
          console.log(`File ${f} uploaded successfully.`);
        }
      }
    })
    return batchUpload({
      method: "POST",
      authHeader: this.getAuthHeader(),
      items,
      callbacks: on,
    })
  }

}
