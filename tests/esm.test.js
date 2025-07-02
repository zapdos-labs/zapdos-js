import { test, expect } from "bun:test";

test("ESM import should succeed", async () => {
  let createClient, importError;
  try {
    ({ createClient } = await import("../src/index.js"));
  } catch (err) {
    importError = err;
  }
  expect(importError).toBeUndefined();
  expect(createClient).toBeDefined();
});

test("Test create client", async () => {
  const { createClient } = await import("../src/index.js");
  const client = createClient({
    apiKey: "test-api-key-123",
    baseUrl: "https://api.zapdos.test",
  });
  expect(client).toBeDefined();
});

test("Test create client with missing API key", async () => {
  const { createClient } = await import("../src/index.js");
  expect(() => {
    createClient({
      baseUrl: "https://api.zapdos.test",
    });
  }).toThrowError("Missing API key");
});

test("Test environment returned", async () => {
  const { createClient } = await import("../src/index.js");
  const client = createClient({
    apiKey: "test-api-key-123",
    baseUrl: "https://api.zapdos.test",
  });
  expect(client.environment).toBe("backend");
});
