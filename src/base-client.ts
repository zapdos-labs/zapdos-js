import type { AxiosUploadItem, BaseClientOptions, Environment, UploadCallbacksWithFileIndex, UploadItem } from "./types";
import { batchUpload, parseNDJSONStream, parseSignedUrl } from "./utils";

/**
 * Abstract base class for Zapdos clients.
 * Enforces implementation of getAuthHeader for authentication.
 */
export abstract class ZapdosBaseClient {
  public abstract get environment(): Environment;
  public readonly baseUrl: string;
  public readonly wsBaseUrl: string;

  constructor(opts: BaseClientOptions) {
    this.baseUrl =
      opts.baseUrl?.replace(/\/+$/, "") || "https://api.zapdoslabs.com";
    if (this.baseUrl.startsWith("https://")) {
      this.wsBaseUrl = this.baseUrl.replace("https://", "wss://") + "/v1/ws";
    } else if (this.baseUrl.startsWith("http://")) {
      this.wsBaseUrl = this.baseUrl.replace("http://", "ws://") + "/v1/ws";
    } else {
      throw new Error("baseUrl must start with https:// or http://");
    }
  }


  /**
   * Upload one or multiple files using presigned URLs
   */
  public async uploadWithSignedUrls(
    uploadItems: UploadItem[],
    on?: UploadCallbacksWithFileIndex,
  ) {
    const parsedUrls = uploadItems.map((item) => parseSignedUrl(item.url));

    const items: AxiosUploadItem[] = parsedUrls.map((parsedUrl, index) => {
      const uploadItem = uploadItems[index];
      return {
        url: parsedUrl.cleanedUrl,
        data: uploadItem.data,
        afterFileData: async () => {
          console.log(`File ${uploadItem.name} uploaded successfully.`);
          const headers: Record<string, string> = {
            "X-Zapdos-Token": parsedUrl.token,
            "Content-Type": "application/json",
          };
          const stream = await this.updateObjectMetadata({
            headers,
            object_id: parsedUrl.object_id,
            metadata: {
              file_name: uploadItem.name,
              size: uploadItem.size,
              content_type: uploadItem.content_type || "application/octet-stream",
              kind: "video",
            },
          });

          if (stream) {
            for await (const msg of stream) {
              console.log("Metadata update message:", msg);
            }
          }
        },
      }
    });

    return batchUpload({
      items,
      callbacks: on,
      method: "PUT",
    })
  }

  private async updateObjectMetadata(opts: {
    headers?: Record<string, string>;
    object_id: string;
    metadata: Record<string, any>;
  }) {
    // Use fetch to stream and log NDJSON
    const url = `${this.baseUrl}/v1/storage/${opts.object_id}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: opts.headers,
      body: JSON.stringify({ metadata: opts.metadata, create_indexing_job: true }),
    });
    if (!response.body) return;

    const stream = parseNDJSONStream(response.body);
    return stream;
  }

}
