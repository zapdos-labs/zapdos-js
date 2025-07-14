import { BackendZapdosClient } from "./backend-client";
import { BrowserZapdosClient } from "./browser-client";
import type {
  BackendClientOptions,
  BrowserClientOptions,
  BaseClientOptions,
  ObjectStorageItem,
  VideoObject
} from "./types";

/**
 * Create a Zapdos client for Node.js (backend) only.
 */
export function createClient(options: BackendClientOptions) {
  return new BackendZapdosClient(options);
}

/**
 * Create a Zapdos client for browser only.
 */
export function createBrowserClient(options: BrowserClientOptions) {
  return new BrowserZapdosClient(options);
}

// Export types for consumers
export type { BackendClientOptions, BaseClientOptions, BrowserClientOptions, ObjectStorageItem, VideoObject };

// Default export for convenience
export default { createClient, createBrowserClient };
