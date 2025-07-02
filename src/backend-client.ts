import axios from "axios";
import jwt from "jsonwebtoken";
import { ZapdosBaseClient } from "./base-client";
import { ResourceRequestBuilderWithSelect } from "./resource-request-builder";
import type {
  BackendClientOptions,
  Environment,
  JobsResponse,
  ObjectStorageResponse,
  WebSocketOptions,
} from "./types";

export class BackendZapdosClient extends ZapdosBaseClient {
  public get environment(): Environment {
    return "backend";
  }
  public readonly apiKey: string;

  constructor(options: BackendClientOptions) {
    super(options.baseUrl);
    if (!options) {
      throw new Error("Missing backend client options");
    }

    if (!options.apiKey) {
      throw new Error("Missing API key");
    }

    this.apiKey = options.apiKey;
  }

  from<T = any>(resource: string): ResourceRequestBuilderWithSelect<T> {
    return new ResourceRequestBuilderWithSelect<T>(this, resource);
  }

  /**
   * Calls the /v1/token endpoint and returns the response as text.
   */
  async token(): Promise<
    | {
        data: {
          token: string;
        };
        error?: undefined;
      }
    | {
        error: {
          message: string;
        };
        data?: undefined;
      }
  > {
    const response = await axios.post(
      `${this.baseUrl}/v1/token`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    );

    return response.data;
  }

  getAuthHeader(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  // Convenient methods to query
  videos() {
    return this.from<ObjectStorageResponse>("object_storage")
      .select()
      .where("metadata->>'content_type'", "~", "^video/");
  }

  images() {
    return this.from<ObjectStorageResponse>("object_storage")
      .select()
      .where("metadata->>'content_type'", "~", "^image/");
  }

  jobs() {
    return this.from<JobsResponse>("jobs").select();
  }

  listen(opts: WebSocketOptions) {
    const ws = new WebSocket(this.wsBaseUrl);

    ws.onopen = (event) => {
      console.log("WebSocket connected");
      opts.onOpen?.(event);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        try {
          opts.onMessage?.(data);
        } catch (error) {
          console.error("Error in onMessage callback:", error);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      opts.onError?.(error);
    };

    ws.onclose = (event) => {
      console.log("WebSocket disconnected:", event.code, event.reason);
      opts.onClose?.(event);
    };

    return ws;
  }
  /**
   * Signs a JWT token for presigned access using the API key as the secret.
   */
  signToken({
    objectIds = [],
    expiresInSeconds = 600, // 10 minutes
  }: {
    objectIds?: string[];
    expiresInSeconds?: number;
  }): { token: string } {
    const now = Math.floor(Date.now() / 1000); // current time in seconds
    const exp = now + expiresInSeconds;

    const claims: jwt.JwtPayload = {
      aud: ["api"],
      iat: now,
      exp,
      access: {
        objects: objectIds,
      },
    };

    const token = jwt.sign(claims, this.apiKey, { algorithm: "HS256" });

    return { token };
  }
}
