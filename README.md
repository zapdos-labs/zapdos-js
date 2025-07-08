# zapdos-js

**zapdos-js** is a lightweight TypeScript client for interacting with the [Zapdos API](https://zapdoslabs.com), supporting both backend (Node.js) and browser environments.


## Installation

```bash
npm install zapdos-js
# or
yarn add zapdos-js
```

## Quick Start

### Backend (Node.js)

```typescript
import { createClient } from "zapdos-js";

const client = createClient({
  apiKey: "your-api-key",
  baseUrl: "https://api.zapdoslabs.com", // optional, defaults to this URL
});

// Query videos
const videos = await client.videos().fetch();

// Upload local files
const uploadResult = await client.upload(["./path/to/file1.mp4", "./path/to/file2.png"], {
  file: {
    onProgress: ({ file_index, value }) => {
      console.log(`File ${file_index} progress: ${value * 100}%`);
    },
  },
});
```

### Browser

```typescript
import { createBrowserClient } from "zapdos-js";

const client = createBrowserClient({
  baseUrl: "https://api.zapdoslabs.com", // optional
});

// Upload browser files with signed URLs (obtained from your backend)
const uploadResult = await client.upload(
  signedUrlsArray,
  fileInput.files,
  {
    file: {
      onProgress: ({ file_index, value }) => {
        console.log(`File ${file_index} progress: ${value * 100}%`);
      },
    },
  }
);
```

## Core Features

* **Type-safe querying**: Use `from(resource).select(...).where(...).limit(...)` for flexible API queries.
* **File uploads**: Upload files with pre-signed URLs, supporting progress and error callbacks.
* **WebSocket support** (backend only): Listen to real-time events via WebSocket.
* **Supports backend and browser environments** with separate client classes.

---

## API Reference

### Creating Clients

* `createClient(options: { apiKey: string; baseUrl?: string })` — Backend client
* `createBrowserClient(options: { baseUrl?: string })` — Browser client

### Querying Data (Backend Only)

```typescript
client.from("resourceName").select("field1", "field2").where("field", "=", value).limit(10).fetch();
```

### Uploading Files

* Backend client: Upload local files by file path(s).
* Browser client: Upload `File` objects using signed URLs.

### Search

```typescript
const searchResult = await client.search("cats playing piano", { limit: 5 });
console.log(searchResult.data?.items);
```

### Get Download URLs

```typescript
const result = await client.getDownloadUrls(["object-id-0001", "object-id-0002"]);
console.log(result.data?.urls, result.data?.expiresAt);
```

### WebSocket (Backend Only)

```typescript
const ws = client.listen({
  onOpen: () => console.log("Connected"),
  onMessage: (data) => console.log("Message received", data),
  onError: (err) => console.error("Error", err),
  onClose: () => console.log("Disconnected"),
});
```

---

## Contributing

Bug reports and pull requests are welcome!

---

## License

MIT
