import axios from "axios";
import { AxiosUploadItem, unextendCallbacks, UpdateMetadataReturnedJSON, UploadCallbacks, UploadCallbacksWithFileIndex } from "./types";
import { ReadStream } from "fs";

/**
 * Async generator to parse a ReadableStream of NDJSON and yield each JSON object.
 */
export async function* parseNDJSONStream(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (line.trim()) {
        try {
          yield JSON.parse(line);
        } catch (e) {
          console.warn("Failed to parse NDJSON line", line, e);
        }
      }
    }
  }
  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer);
    } catch (e) {
      console.warn("Failed to parse NDJSON line", buffer, e);
    }
  }
}

/**
 * Utility to extract specified query params from a URL and return both:
 * - a dictionary of param values
 * - the URL with those params removed from the query string
 */
export function extractCustomParams(
  url: string,
  params: string[],
): { params: Record<string, string | undefined>; cleanedUrl: string } {
  try {
    const u = new URL(url);
    const values: Record<string, string | undefined> = {};
    for (const param of params) {
      values[param] = u.searchParams.get(param) || undefined;
      u.searchParams.delete(param);
    }
    return {
      params: values,
      cleanedUrl: u.toString(),
    };
  } catch {
    return {
      params: Object.fromEntries(params.map((p) => [p, undefined])),
      cleanedUrl: url,
    };
  }
}


export async function axiosUpload({
  url,
  method = "POST",
  file,
  headers = {},
  callbacks
}: {
  url: string;
  method?: "POST" | "PUT";
  file: ReadStream | File;
  headers?: Record<string, string>;
  callbacks?: UploadCallbacks;
}) {
  try {
    const response = await axios({
      url,
      method,
      data: file,
      headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (progressEvent) => {
        const value = progressEvent.total
          ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
          : 0;
        callbacks?.onProgress?.({ value });
      },
    });
    callbacks?.onStored?.();
    return response.data as {
      data: {}
    };
  } catch (error: any) {
    callbacks?.onFailed?.({ message: error.message || "Upload failed" });
    return {
      error: {
        message: error.message || "Axios Upload failed",
      }
    }
  }
}

export function prepareMinimalCallbacks(callbacks: UploadCallbacksWithFileIndex, fileIndex: number, resolve: (result: Result) => void): UploadCallbacks | undefined {
  if (!callbacks) return undefined;

  const minimalCallbacks = unextendCallbacks(callbacks, { file_index: fileIndex });
  return {
    ...minimalCallbacks,
    onCompleted(args) {
      const result = { ...args, file_index: fileIndex };
      minimalCallbacks?.onCompleted?.(result);
      resolve({
        data: result
      });
      return result;
    },
    onFailed(args) {
      const result = { ...args, file_index: fileIndex };
      minimalCallbacks?.onFailed?.(result);
      resolve({
        error: result
      });
      return result;
    }
  };
}

type Result = {
  data: {
    file_index: number;
  };
  error?: undefined;
} | {
  data?: undefined;
  error: {
    file_index: number;
  };
}

/**
 * Common batch upload handler for both browser and backend clients
 */
export async function batchUpload(opts: {
  baseUrl: string;
  authHeader?: Record<string, string>;
  items: AxiosUploadItem[];
  callbacks?: UploadCallbacksWithFileIndex;
}) {
  const uploadPromises = opts.items.map((item) =>
    new Promise<Result>(async (resolve) => {
      let minimumCallbacks: UploadCallbacks | undefined = undefined;
      if (opts.callbacks) {
        minimumCallbacks = prepareMinimalCallbacks(opts.callbacks, item.index, resolve);
      }

      // Uploading to signed url just returns null
      const _ = await axiosUpload({
        url: item.signedUrl,
        method: 'PUT',
        file: item.data,
        headers: opts.authHeader,
        callbacks: minimumCallbacks,
      });

      // Trigger updating metadata & indexing job
      (async () => {
        const headers = {
          "X-Zapdos-Token": item.token,
          "Content-Type": "application/json",
        };
        const stream = await updateObjectMetadata({
          url: `${opts.baseUrl}/v1/storage/${item.object_id}`,
          headers,
          metadata: item.metadata,
        });

        if (stream) {
          handleStream(stream, minimumCallbacks);
        }
      })();
    })
  );


  const results = await Promise.all(uploadPromises);
  return results.toSorted((a, b) => (a?.data || a.error).file_index - (b?.data || b.error).file_index);
}

export function parseSignedUrl(signedUrl: string) {
  const { params, cleanedUrl } = extractCustomParams(signedUrl, [
    "X-Zapdos-Obj-Id",
    "X-Zapdos-Token",
  ]);
  const token = params["X-Zapdos-Token"];
  const object_id = params["X-Zapdos-Obj-Id"];
  if (!object_id || !token) {
    throw new Error("Malformed signed url");
  }

  return { token, object_id, cleanedUrl };
}


async function updateObjectMetadata(opts: {
  url: string;
  headers?: Record<string, string>;
  metadata: Record<string, any>;
}) {
  const response = await fetch(opts.url, {
    method: "PATCH",
    headers: opts.headers,
    // FLAGS
    // TODO: Allow setting create_indexing_job to false
    // User would have to manually triggering indexing job later
    // This means decoupling the indexing job logic from metadata update route in the backend
    // Currently the backend always creates an indexing job when metadata is updated
    // Only that the route returns immediately and the job is processed in the background
    body: JSON.stringify({
      metadata: opts.metadata,
      create_indexing_job: true,
    }),
  });
  if (!response.body) return;

  const stream = parseNDJSONStream(response.body) as AsyncGenerator<UpdateMetadataReturnedJSON, void, unknown>;
  return stream;
}


async function handleStream(stream: AsyncGenerator<UpdateMetadataReturnedJSON, void, unknown>, on?: UploadCallbacks) {
  for await (const msg of stream) {
    if (msg.error) {
      console.log("Error in metadata update stream", msg.error);
      continue;
    }

    if (msg.data.type === 'metadata_updated') {
      on?.onCompleted?.({
        object_id: msg.data.object_id,
      });
    }
    if (msg.data.type === 'indexing_started') {
      on?.job?.onIndexingStarted?.({
        object_id: msg.data.object_id,
        job_id: msg.data.job_id,
      });
    }

    if (msg.data.type === 'indexing_failed') {
      on?.job?.onIndexingFailed?.({
        object_id: msg.data.object_id,
        job_id: msg.data.job_id,
      });
    }

    if (msg.data.type === 'indexing_completed') {
      on?.job?.onIndexingCompleted?.({
        object_id: msg.data.object_id,
        job_id: msg.data.job_id,
      });
    }
  }
}