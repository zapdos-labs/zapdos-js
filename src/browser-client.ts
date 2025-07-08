import { ZapdosBaseClient } from "./base-client";
import { batchUpload, parseNDJSONStream, parseSignedUrl } from "./utils";

import {
  BrowserClientOptions,
  Environment,
  UploadCallbacksWithFileIndex
} from "./types";

export class BrowserZapdosClient extends ZapdosBaseClient {
  public get environment(): Environment {
    return "browser";
  }

  constructor(options: BrowserClientOptions) {
    if (!options) {
      throw new Error("Missing browser client options");
    }
    super(options);

    // Simple log to confirm client creation
    console.log("Zapdos client created in browser");
  }

  /**
   * Upload one or multiple files using presigned URLs
   */
  public async upload(
    signedUrls: string | string[],
    files: File | File[],
    on?: UploadCallbacksWithFileIndex,
  ) {
    const fileArray = Array.isArray(files) ? files : [files];
    const urlArray = typeof signedUrls === "string" ? [signedUrls] : signedUrls;

    if (urlArray.length !== fileArray.length) {
      throw new Error("Number of signed URLs must match number of files");
    }

    const parsedUrls = urlArray.map((url) => parseSignedUrl(url));
    const items = parsedUrls.map((parsedUrl, index) => {
      const file = fileArray[index];
      return {
        url: parsedUrl.cleanedUrl,
        data: file,
        afterFileData: async () => {
          console.log(`File ${file.name} uploaded successfully.`);
          const stream = await this.updateObjectMetadata({
            token: parsedUrl.token,
            object_id: parsedUrl.object_id,
            metadata: {
              file_name: file.name,
              size: file.size,
              content_type: file.type || "application/octet-stream",
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
      authHeader: await this.getAuthHeader(),
    })
  }

  private async updateObjectMetadata(opts: {
    token: string;
    object_id: string;
    metadata: Record<string, any>;
  }) {
    // Use fetch to stream and log NDJSON
    const url = `${this.baseUrl}/v1/storage/${opts.object_id}`;
    const headers: Record<string, string> = {
      "X-Zapdos-Token": opts.token,
      ...(await this.getAuthHeader()),
      "Content-Type": "application/json",
    };
    const response = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ metadata: opts.metadata, create_indexing_job: true }),
    });
    if (!response.body) return;

    const stream = parseNDJSONStream(response.body);
    return stream;
  }

  async getAuthHeader() {
    return {};
  }
}
