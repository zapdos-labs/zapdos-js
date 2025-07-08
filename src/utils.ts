import axios from "axios";
import { AxiosUploadItem, unextendCallbacks, UploadCallbacks, UploadCallbacksWithFileIndex } from "./types";
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
        callbacks?.file?.onProgress?.({ value });
      },
    });
    callbacks?.file?.onData?.(response.data);
    return response.data;
  } catch (error: any) {
    callbacks?.file?.onError?.({ message: error.message || "Upload failed" });
    throw error;
  }
}

export function prepareMinimalCallbacks(callbacks: UploadCallbacksWithFileIndex, fileIndex: number, resolve: (result: Result) => void): UploadCallbacks | undefined {
  if (!callbacks) return undefined;

  const minimalCallbacks = unextendCallbacks(callbacks, { file_index: fileIndex });
  return {
    ...minimalCallbacks,
    file: {
      ...minimalCallbacks?.file,

      onData: (props) => {
        const result = { ...props, file_index: fileIndex };
        minimalCallbacks?.file?.onData?.(result);
        resolve({
          data: result
        });
        return result;
      },
      onError: (args) => {
        const result = { ...args, file_index: fileIndex };
        minimalCallbacks?.file?.onError?.(result);
        resolve({
          error: result
        });
        return result;
      }
    },
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
  authHeader?: Record<string, string>;
  method: "POST" | "PUT";
  items: AxiosUploadItem[];
  callbacks?: UploadCallbacksWithFileIndex;
}) {
  const uploadPromises = opts.items.map((item, idx) =>
    new Promise<Result>(async (resolve) => {
      let minimumCallbacks: UploadCallbacks | undefined = undefined;
      if (opts.callbacks) {
        minimumCallbacks = prepareMinimalCallbacks(opts.callbacks, idx, resolve);
      }
      const result = await axiosUpload({
        url: item.url,
        method: opts.method,
        file: item.data,
        headers: opts.authHeader,
        callbacks: minimumCallbacks,
      });

      return { data: result };
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