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
        url: parsedUrl.cleanedUrl,
        data: uploadItem.data,
        afterFileData: async () => {
          this.logger.log(`File ${uploadItem.name} uploaded successfully.`);
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
            this.handleStream(stream, index, on);
          }
        },
      }
    });

    return batchUpload({
      items,
      callbacks: on,
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
      // TODO: Allow setting create_indexing_job to false
      // User would have to manually triggering indexing job later
      // This means decoupling the indexing job logic from metadata update route in the backend
      body: JSON.stringify({ metadata: opts.metadata, create_indexing_job: true }),
    });
    if (!response.body) return;

    const stream = parseNDJSONStream(response.body) as AsyncGenerator<UpdateMetadataReturnedJSON, void, unknown>;
    return stream;
  }

  private async handleStream(stream: AsyncGenerator<UpdateMetadataReturnedJSON, void, unknown>, index: number, on?: UploadCallbacksWithFileIndex) {
    for await (const msg of stream) {
      if (msg.data.type === 'metadata_updated') {
        this.logger.log(`Metadata updated for object ${msg.data.object_id}`);
        on?.onCompleted?.({
          file_index: index,
          object_id: msg.data.object_id,
        });
      }
      if (msg.data.type === 'indexing_started') {
        this.logger.log(`Indexing started for object ${msg.data.object_id} with job ID ${msg.data.job_id}`);
        on?.job?.onIndexingStarted?.({
          file_index: index,
          object_id: msg.data.object_id,
          job_id: msg.data.job_id,
        });
      }

      if (msg.data.type === 'indexing_failed') {
        this.logger.error(`Indexing failed for object ${msg.data.object_id} with job ID ${msg.data.job_id}`);
        on?.job?.onIndexingFailed?.({
          file_index: index,
          object_id: msg.data.object_id,
          job_id: msg.data.job_id,
        });
      }

      if (msg.data.type === 'indexing_completed') {
        this.logger.log(`Indexing completed for object ${msg.data.object_id} with job ID ${msg.data.job_id}`);
        on?.job?.onIndexingCompleted?.({
          file_index: index,
          object_id: msg.data.object_id,
          job_id: msg.data.job_id,
        });
      }
    }
  }

}
