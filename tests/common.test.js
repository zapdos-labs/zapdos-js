import { expect, test } from "bun:test";

test("Test create client", () => {
  const { createClient } = require("../src/index.js");
  const client = createClient({
    apiKey: "test-api-key-123",
    baseUrl: "https://api.zapdos.test",
  });

  expect(client).toBeDefined();
});

test("Test create client with missing API key", () => {
  const { createClient } = require("../src/index.js");
  expect(() => {
    createClient({
      baseUrl: "https://api.zapdos.test",
    });
  }).toThrowError("Missing API key");
});

test("Test environment returned", () => {
  const { createClient } = require("../src/index.js");
  const client = createClient({
    apiKey: "test-api-key-123",
    baseUrl: "https://api.zapdos.test",
  });

  expect(client.environment).toBe("backend");
});
