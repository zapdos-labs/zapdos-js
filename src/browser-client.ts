import axios from "axios";
import { ZapdosBaseClient } from "./base-client";

import {
  Environment,
  BrowserClientOptions,
  OnProgressCallback,
  FileUploadSuccess,
  FileUploadError,
  FileUploadErrorPartial,
  FileUploadSuccessPartial,
  WebSocketOptions,
} from "./types";

export class BrowserZapdosClient extends ZapdosBaseClient {
  public get environment(): Environment {
    return "browser";
  }
  public readonly getSignedToken: () => Promise<string>;

  constructor(options: BrowserClientOptions) {
    if (!options) {
      throw new Error("Missing browser client options");
    }

    if (!options.getSignedToken) {
      console.warn(
        "getSignedToken is not setup. This method is required to pass X-Token header and authorize requests from browser.",
      );
    }

    super(options.baseUrl);

    this.getSignedToken = options.getSignedToken;

    // Simple log to confirm client creation
    console.log("Zapdos client created in browser");
  }

  /**
   * Upload one or multiple files
   */
  public async upload(
    files: File | File[],
    options?: {
      onFileProgress?: OnProgressCallback;
      onFileSuccess?: (data: FileUploadSuccess) => void;
      onFileError?: (error: FileUploadError) => void;
    },
  ) {
    const fileArray = Array.isArray(files) ? files : [files];
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
   */
  private async uploadFile(opts: {
    file: File;
    onProgress: (progress: number) => void;
    onError: (error: FileUploadErrorPartial) => void;
    onData: (data: FileUploadSuccessPartial) => void;
  }) {
    let token: string;
    try {
      token = await this.getSignedToken();
      if (!token) {
        throw new Error("Failed to get signed token");
      }
    } catch (error) {
      opts.onError({
        message: (error as any)?.message || "Failed to get signed token",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", opts.file);

    const storageURL = `${this.baseUrl}/v1/storage`;

    try {
      const response = await axios.post(storageURL, formData, {
        headers: await this.getAuthHeader(),
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            opts.onProgress(progress);
          }
        },
      });

      if (response.data && response.data.data) {
        opts.onData(response.data.data);
      } else {
        opts.onError({
          message:
            response.data?.error?.msg ||
            response.data?.error ||
            "Failed to upload file",
        });
      }
    } catch (error: any) {
      opts.onError({
        message:
          error.response?.data?.error?.msg ||
          error.message ||
          "Network error during upload",
      });
    }
  }

  async getAuthHeader() {
    return {
      "X-Token": await this.getSignedToken(),
    };
  }
}
