/**
 * The classes in this file implement the query builder for the Zapdos client.
 * The builder is designed to be type-safe and enforce a specific chain of calls:
 * `from(resource).select(columns).where(...)`
 *
 * ### Example Usage
 *
 * ```typescript
 * const result = await client
 *   .from("objects")
 *   .select("id", "name", "metadata")
 *   .where("metadata->>size", ">", 1024)
 *   .sort("desc")
 *   .limit(10)
 *   .cursor("some-cursor-id");
 * ```
 *
 * ### Generated Request Body
 *
 * The code above would send a POST request to `/v1/query` with the following JSON body:
 *
 * ```json
 * {
 *   "from": "objects",
 *   "select": ["id", "name", "metadata"],
 *   "where": [
 *     ["metadata->>size", ">", 1024]
 *   ],
 *   "sort": "desc",
 *   "limit": 10,
 *   "cursor": "some-cursor-id"
 * }
 * ```
 */
import axios from "axios";

// This class is not exported. It contains the core logic for making the request
// and handling the promise-like behavior.
class RequestBuilderCore<T> {
  constructor(
    public baseUrl: string,
    public headers: Record<string, string>,
    public resource: string,
    public queryParams: Record<string, any>,
  ) {

  }

  protected getPromise(): Promise<T> {
    const url = `${this.baseUrl}/v1/query`;
    // The request body is flattened, with `from` at the top level.
    const body = {
      from: this.resource,
      ...this.queryParams,
    };

    return axios.post<T>(url, body, {
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
    })
      .then((res: { data: T }) => res.data)
      .catch((error: any) => {
        if (
          error?.isAxiosError &&
          error?.response &&
          typeof error.response.data === "object"
        ) {
          return error.response.data;
        }
        return { error: { message: error?.message || "Unknown error" } };
      });
  }
}

/**
 * Query builder.
 * It has all the query methods like .where(), .limit(), etc., and is thenable.
 */
export class QueryBuilder<T> extends RequestBuilderCore<T> {
  limit(limit: number): QueryBuilder<T> {
    this.queryParams["limit"] = limit;
    return this;
  }

  sort(sort: "asc" | "desc"): QueryBuilder<T> {
    this.queryParams["sort"] = sort;
    return this;
  }

  cursor(cursor: string): QueryBuilder<T> {
    this.queryParams["cursor"] = cursor;
    return this;
  }

  where(field: string, operator: string, value: string | number): QueryBuilder<T> {
    if (!this.queryParams.where) {
      this.queryParams.where = [];
    }
    this.queryParams.where.push([field, operator, value]);
    return this;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ) {
    return this.getPromise().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | undefined
      | null,
  ) {
    return this.getPromise().catch(onrejected);
  }

  finally(
    onfinally?: (() => void) | undefined | null,
  ) {
    return this.getPromise().finally(onfinally);
  }

  fetch(): Promise<T> {
    return this.getPromise();
  }
}

/**
 * Builder returned by .from(). This class only exposes a .select() method,
 * enforcing the next step in the chain.
 */
export class UnselectedQueryBuilder<T> {

  constructor(
    public baseUrl: string,
    public headers: Record<string, string>,
    public resource: string
  ) { }

  /**
   * Specify which columns to return.
   * @param columns The column names to select.
   * @returns The full builder with all query methods.
   */
  select(...columns: string[]): QueryBuilder<T> {
    const queryParams = {
      where: [],
      select: columns.length > 0 ? columns : ["*"], // Default to selecting all if no columns are provided
    };
    return new QueryBuilder<T>(
      this.baseUrl,
      this.headers,
      this.resource,
      queryParams,
    );
  }
}

