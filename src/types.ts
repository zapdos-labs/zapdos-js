import { ReadStream } from "node:fs";

export interface BaseClientOptions {
  baseUrl?: string;
  verbose?: boolean;
}

export interface BackendClientOptions extends BaseClientOptions {
  apiKey: string;
}

export interface BrowserClientOptions extends BaseClientOptions { }

export type Environment = "browser" | "backend";

/**
 * Utility type for API responses that may contain data or an error.
 */
export type Maybe<T> =
  | { data: T; error?: undefined }
  | { error: { message: string }; data?: undefined };

export type WebSocketOptions = {
  onOpen?: (event: Event) => void;
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  onClose?: (event: CloseEvent) => void;
};

/**
 * Type for object metadata (not base64, but direct object).
 */
export interface ObjectMetadata {
  kind: string;
  size: number;
  file_name: string;
  content_type: string;
}

/**
 * Type for a single object storage item.
 */
export interface ObjectStorageItem {
  created_at: string;
  id: string;
  metadata: ObjectMetadata;
  org_id: string;
}

/**
 * Type for the object storage response.
 */
export type ObjectStorageResponse = Maybe<ObjectStorageItem[]>;

/**
 * Type for the job content object.
 */
export interface JobContent {
  object_id: string;
  type: string;
}

/**
 * Type for a single job item.
 */
export interface JobItem {
  content: JobContent;
  created_at: string;
  id: string;
  org_id: string;
  status: string;
}

/**
 * Type for the jobs response.
 */
export type JobsResponse = Maybe<JobItem[]>;

export type GetUploadUrlsResult = {
  data: string[];
  error?: undefined
} | {
  error: { message: string };
  data?: undefined
};

export type UpdateMetadataReturnedJSON =
  | { data: { type: "metadata_updated"; object_id: string } }
  | { data: { type: "indexing_started"; job_id: string; object_id: string } }
  | { data: { type: "indexing_completed"; job_id: string; object_id: string } }
  | { data: { type: "indexing_failed"; job_id: string; object_id: string } };

export type JobCallbacks = {
  onIndexingStarted?: (props: { object_id: string, job_id: string }) => void;
  onIndexingCompleted?: (props: { object_id: string, job_id: string }) => void;
  onIndexingFailed?: (props: { object_id: string, job_id: string }) => void;
}

export type FileCallbacks = {
  onError?: (error: {
    message: string;
  }) => void;
  onData?: (data: { object_id: string }) => void;
  onProgress?: (progress: { value: number }) => void
}



export type UploadCallbacks = {
  file?: FileCallbacks
  job?: JobCallbacks
}


// Utility type: Recursively extends the first argument of all function properties with Ext
export type ExtendArgs<T, Ext extends object> = {
  [K in keyof T]: T[K] extends ((arg: infer A) => infer R) | undefined
  ? ((arg: A & Ext) => R) | undefined
  : T[K] extends object | undefined
  ? T[K] extends (...args: any) => any
  ? T[K]
  : T[K] extends undefined
  ? undefined
  : ExtendArgs<NonNullable<T[K]>, Ext> | Extract<T[K], undefined>
  : T[K];
};

export type UploadCallbacksWithFileIndex = ExtendArgs<UploadCallbacks, { file_index: number }>;

// Utility type to remove extension from callback arguments
export type UnextendArgs<T, Ext extends object> = {
  [K in keyof T]: T[K] extends ((arg: infer A) => infer R) | undefined
  ? A extends (Ext & infer Rest)
  ? ((arg: Rest) => R) | undefined
  : T[K]
  : T[K] extends object | undefined
  ? T[K] extends (...args: any) => any
  ? T[K]
  : T[K] extends undefined
  ? undefined
  : UnextendArgs<NonNullable<T[K]>, Ext> | Extract<T[K], undefined>
  : T[K];
};

export function unextendCallbacks<T, Ext extends object>(
  callbacks: ExtendArgs<T, Ext> | undefined,
  ext: Ext
): T | undefined {
  if (!callbacks) return undefined;

  const result = {} as T;

  for (const key in callbacks) {
    const value = callbacks[key];

    if (typeof value === 'function') {
      // Create a new function that calls the original with the extended arguments
      (result as any)[key] = (arg: any) => {
        return value({ ...arg, ...ext });
      };
    } else if (value && typeof value === 'object') {
      // Recursively handle nested objects
      (result as any)[key] = unextendCallbacks(value, ext);
    } else {
      // Copy primitive values as-is
      (result as any)[key] = value;
    }
  }

  return result;
}

export type UploadItem = {
  name: string;
  size: number;
  content_type?: string;
  url: string;
  data: File | ReadStream;
}

export type AxiosUploadItem = {
  url: string;
  data: ReadStream | File;
  afterFileData: () => Promise<void>;
}