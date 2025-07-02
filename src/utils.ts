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
