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
