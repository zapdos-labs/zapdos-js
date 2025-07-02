import { expect, test } from "bun:test";

test("Test create browser client", () => {
  const { createBrowserClient } = require("../src/index.js");
  const client = createBrowserClient({
    baseUrl: "https://api.zapdos.test",
  });

  expect(client).toBeDefined();
});

test("Test environment returned", () => {
  const { createBrowserClient } = require("../src/index.js");
  const client = createBrowserClient({
    baseUrl: "https://api.zapdos.test",
  });

  expect(client.environment).toBe("browser");
});
