import axios from "axios";
import { ZapdosBaseClient } from "./base-client";
import { unextendCallbacks } from "./types";

import {
  BrowserClientOptions,
  Environment,
  UploadCallbacks,
  UploadCallbacksWithFileIndex
} from "./types";
import { extractCustomParams, parseNDJSONStream } from "./utils";

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
   * Upload one or multiple files
   */
  /**
   * Upload one or multiple files using a single presigned URL (string) or an array of presigned URLs (string[]).
   * If a single file is provided, a single URL (string) can be used.
   * If multiple files are provided, an array of URLs (string[]) must be used.
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

    const uploadPromises: Promise<
      | {
        data: any;
        error?: undefined;
      }
      | {
        error: any;
        data?: undefined;
      }
    >[] = fileArray.map(
      (file, idx) =>
        new Promise((resolve, reject) => {
          // We say that upload method is responsible for passing { file_index: idx }, while uploadFile responsible for the rest of the callbacks args
          const minimalCallbacks = unextendCallbacks(on, { file_index: idx });
          const hookedCallbacks = {
            ...minimalCallbacks,
            file: {
              ...minimalCallbacks?.file,
              onData: (props: any) => {
                console.log('onData is called');
                resolve({ data: { ...props, file_index: idx } });
              },
              onError: (args: any) => {
                console.log('onError is called');
                resolve({ error: { ...args, file_index: idx } });
              }
            },
          }

          this.uploadFile({
            signedUrl: urlArray[idx],
            file,
            on: hookedCallbacks
          });
        })
    );

    const results = await Promise.all(uploadPromises);
    return results.toSorted(
      (a, b) => (a.data || a.error).file_index - (b.data || b.error).file_index,
    );
  }

  /**
   * Private method to handle the actual file upload logic for a single file, using Axios
   * Uses PUT and sends raw file bytes for S3 presigned URL compatibility
   */
  private async uploadFile(opts: {
    signedUrl: string;
    file: File;
    on?: UploadCallbacks
  }) {
    try {
      // Get object_id from signed URL
      const { params, cleanedUrl } = extractCustomParams(opts.signedUrl, [
        "X-Zapdos-Obj-Id",
        "X-Zapdos-Token",
      ]);
      const token = params["X-Zapdos-Token"];
      const object_id = params["X-Zapdos-Obj-Id"];
      if (!object_id || !token) {
        throw new Error("Malformed signed url");
      }

      console.log("Uploading", token, object_id);
      const response = await axios.put(cleanedUrl, opts.file, {
        headers: {
          ...(await this.getAuthHeader()),
          "Content-Type": opts.file.type || "application/octet-stream",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const value = (progressEvent.loaded / progressEvent.total) * 100;
            opts.on?.file?.onProgress?.({ value });
          }
        },
      });

      console.log('call updateObjectMetadata');
      // Update database metadata using objectId and token, always passing metadata from File object
      const stream = await this.updateObjectMetadata({
        token,
        object_id,
        metadata: {
          file_name: opts.file.name,
          size: opts.file.size,
          content_type: opts.file.type || "application/octet-stream",
          kind: "video",
        },
      });

      if (!stream) {
        throw new Error("No response body from metadata update");
      }

      for await (const msg of stream) {
        // TODO: Handle each message from the NDJSON stream
        console.log("Metadata update message:", msg);
      }

      console.log("File uploaded successfully", object_id);
      opts.on?.file?.onData?.({ object_id });
    } catch (error: any) {
      opts.on?.file?.onError?.({
        message:
          error.response?.data?.error?.msg ||
          error.message ||
          "Network error during upload",
      });
    }
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
