import { Logger } from "./logger";
import type { AxiosUploadItem, BaseClientOptions, Environment, UpdateMetadataReturnedJSON, UploadCallbacksWithFileIndex, UploadItem } from "./types";
import { batchUpload, parseNDJSONStream, parseSignedUrl } from "./utils";

/**
 * Abstract base class for Zapdos clients.
 * Enforces implementation of getAuthHeader for authentication.
 */
export abstract class ZapdosBaseClient {
  public abstract get environment(): Environment;
  public readonly baseUrl: string;
  public readonly wsBaseUrl: string;
  public readonly logger: Logger;

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
    this.logger = new Logger(opts.verbose);
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
        index,
        signedUrl: parsedUrl.cleanedUrl,
        data: uploadItem.data,
        token: parsedUrl.token,
        object_id: parsedUrl.object_id,
        metadata: {
          file_name: uploadItem.name,
          size: uploadItem.size,
          content_type: uploadItem.content_type || "application/octet-stream",
          kind: "video",
        },
      }
    });

    return batchUpload({
      baseUrl: this.baseUrl,
      items,
      callbacks: on,
    })
  }



}
