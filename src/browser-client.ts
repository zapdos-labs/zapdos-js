import axios from "axios";
import { ZapdosBaseClient } from "./base-client";

import {
  BrowserClientOptions,
  Environment,
  FileUploadError,
  FileUploadErrorPartial,
  FileUploadSuccess,
  FileUploadSuccessPartial,
  OnProgressCallback,
} from "./types";
import { extractCustomParams } from "./utils";

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
    options?: {
      onFileProgress?: OnProgressCallback;
      onFileSuccess?: (data: FileUploadSuccess) => void;
      onFileError?: (error: FileUploadError) => void;
    },
  ) {
    const fileArray = Array.isArray(files) ? files : [files];
    const urlArray = typeof signedUrls === "string" ? [signedUrls] : signedUrls;

    if (urlArray.length !== fileArray.length) {
      throw new Error("Number of signed URLs must match number of files");
    }

    const uploadPromises: Promise<
      | {
        data: FileUploadSuccess;
        error?: undefined;
      }
      | {
        error: FileUploadError;
        data?: undefined;
      }
    >[] = fileArray.map(
      (file, idx) =>
        new Promise((resolve, reject) => {
          this.uploadFile({
            signedUrl: urlArray[idx],
            file,
            onProgress(progress) {
              options?.onFileProgress?.({
                file_index: idx,
                value: progress,
              });
            },
            onError(error) {
              const fileError: FileUploadError = {
                file_index: idx,
                ...error,
              };
              options?.onFileError?.(fileError);
              resolve({
                error: fileError,
              });
            },
            onData(data) {
              const fileSuccess = {
                ...data,
                file_index: idx,
              };
              options?.onFileSuccess?.(fileSuccess);
              resolve({
                data: fileSuccess,
              });
            },
          });
        }),
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
    onProgress: (progress: number) => void;
    onError: (error: FileUploadErrorPartial) => void;
    onData: (data: FileUploadSuccessPartial & { object_id?: string }) => void;
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
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            opts.onProgress(progress);
          }
        },
      });

      console.log("response.data", response.data);

      // Update database metadata using objectId and token, always passing metadata from File object
      await this.updateObjectMetadata({
        token,
        object_id,
        metadata: {
          file_name: opts.file.name,
          size: opts.file.size,
          content_type: opts.file.type || "application/octet-stream",
          kind: "video",
        },
      });

      // TODO: create indexing job using objectId

      opts.onData({ object_id });
    } catch (error: any) {
      opts.onError({
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
    console.log("updateObjectMetadata called");
    try {
      await axios.patch(
        `${this.baseUrl}/v1/storage/${opts.object_id}`,
        { metadata: opts.metadata },
        {
          headers: {
            "X-Zapdos-Token": opts.token,
            ...(await this.getAuthHeader()),
          },
        },
      );
    } catch (error: any) {
      // Optionally handle/log error
      console.error("Failed to update object metadata", error);
    }
  }

  async getAuthHeader() {
    return {};
  }
}
