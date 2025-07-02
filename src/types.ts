export interface BaseClientOptions {
  baseUrl?: string;
}

export interface BackendClientOptions extends BaseClientOptions {
  apiKey: string;
}

export interface BrowserClientOptions extends BaseClientOptions {
  getSignedToken: () => Promise<string>;
}

export type Environment = "browser" | "backend";

export type OnProgressCallback = (progressItem: {
  value: number;
  file_index: number;
}) => void;

export type FileUploadErrorPartial = {
  message: string;
};

export type FileUploadError = FileUploadErrorPartial & {
  file_index: number;
};

export type FileUploadSuccessPartial = {};

export type FileUploadSuccess = FileUploadSuccessPartial & {
  file_index: number;
};

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
