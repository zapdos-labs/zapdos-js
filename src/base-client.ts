import type { Environment, WebSocketOptions } from "./types";

/**
 * Abstract base class for Zapdos clients.
 * Enforces implementation of getAuthHeader for authentication.
 */
export abstract class ZapdosBaseClient {
  public abstract get environment(): Environment;
  public readonly baseUrl: string;
  public readonly wsBaseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl?.replace(/\/+$/, "") || "https://api.zapdoslabs.com";
    if (this.baseUrl.startsWith("https://")) {
      this.wsBaseUrl = this.baseUrl.replace("https://", "wss://") + "/v1/ws";
    } else if (this.baseUrl.startsWith("http://")) {
      this.wsBaseUrl = this.baseUrl.replace("http://", "ws://") + "/v1/ws";
    } else {
      throw new Error("baseUrl must start with https:// or http://");
    }
  }

  /**
   * Returns the authentication header(s) required for API requests.
   * Must be implemented by subclasses.
   * Can be async or sync depending on the client.
   */
  abstract getAuthHeader():
    | Promise<Record<string, string>>
    | Record<string, string>;
}
