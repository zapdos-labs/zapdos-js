# zapdos-js

**zapdos-js** is a lightweight TypeScript client for interacting with the [Zapdos API](https://app.zapdoslabs.com), supporting both backend (Node.js) and browser environments.


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

// Upload a single file
const singleUploadResult = await client.upload("./path/to/video.mp4", {
  onProgress: ({ file_index, value }) => {
    console.log(`File ${file_index} progress: ${value}%`);
  },
  onCompleted: ({ object_id, file_index }) => {
    console.log(`Upload completed for file ${file_index}, object ID: ${object_id}`);
  },
  job: {
    onIndexingStarted: ({ object_id, job_id }) => {
      console.log(`Indexing started for ${object_id}, job: ${job_id}`);
    },
    onIndexingCompleted: ({ object_id, job_id }) => {
      console.log(`Indexing completed for ${object_id}, job: ${job_id}`);
    },
  },
});

// Upload multiple files
const batchUploadResult = await client.uploadBatch(["./file1.mp4", "./file2.mkv"], {
  onProgress: ({ file_index, value }) => {
    console.log(`File ${file_index} progress: ${value}%`);
  },
});
```

### Browser

```typescript
import { createBrowserClient } from "zapdos-js";

const client = createBrowserClient({
  baseUrl: "https://api.zapdoslabs.com", // optional, defaults to this URL
});

// Upload browser files with signed URLs (obtained from your backend)
const uploadResult = await client.upload(
  signedUrlsArray,
  fileInput.files,
  {
    onProgress: ({ file_index, value }) => {
      console.log(`File ${file_index} progress: ${value}%`);
    },
    onCompleted: ({ object_id, file_index }) => {
      console.log(`Upload completed for file ${file_index}, object ID: ${object_id}`);
    },
  }
);
```

## Core Features

* **Type-safe querying**: Use `from(resource).select(...).where(...).limit(...)` for flexible API queries.
* **File uploads**: Upload files with pre-signed URLs, supporting progress tracking and job status callbacks.
* **WebSocket support** (backend only): Listen to real-time events via WebSocket.
* **File downloads** (backend only): Download files to local filesystem.
* **Search**: Semantic search across video content using embeddings.
* **Supports backend and browser environments** with separate client classes.

---

## API Reference

### Creating Clients

* `createClient(options: { apiKey: string; baseUrl?: string; verbose?: boolean })` — Backend client
* `createBrowserClient(options?: { baseUrl?: string; verbose?: boolean })` — Browser client

### Querying Data (Backend Only)

```typescript
// Query with type safety and method chaining
const result = await client
  .from("object_storage")
  .select("id", "metadata", "created_at")
  .where("metadata->>'content_type'", "~", "^video/")
  .where("metadata->>'size'", ">", "1000000")
  .sort("desc")
  .limit(10)
  .cursor("optional-cursor-for-pagination");

// Convenient shorthand methods (these return UnselectedQueryBuilder)
const videos = await client.videos().fetch(); // Videos by content type
const images = await client.images().fetch(); // Images by content type  
const jobs = await client.jobs().fetch(); // All jobs
const scenes = await client.scenes("video-id").fetch(); // Scenes for a video

// Get single result
const video = await client.videos().limit(1).single();
```

### File Upload Callbacks

Both backend and browser clients support comprehensive upload callbacks:

```typescript
const callbacks = {
  // File upload progress (0-100)
  onProgress: ({ file_index, value }) => console.log(`Progress: ${value}%`),
  
  // When file is stored in S3
  onStored: ({ file_index }) => console.log("File stored"),
  
  // When upload completed and metadata updated
  onCompleted: ({ object_id, file_index }) => console.log(`Done: ${object_id}`),
  
  // On upload failure
  onFailed: ({ message, file_index }) => console.error(`Failed: ${message}`),
  
  // Job status callbacks
  job: {
    onIndexingStarted: ({ object_id, job_id }) => console.log("Indexing started"),
    onIndexingCompleted: ({ object_id, job_id }) => console.log("Indexing done"),
    onIndexingFailed: ({ object_id, job_id }) => console.log("Indexing failed"),
    onTranscription: ({ object_id, job_id }) => console.log("Transcription done"),
  }
};
```

### Uploading Files

**Backend client:**
```typescript
// Upload single file
const result = await client.upload("./video.mp4", callbacks);

// Upload multiple files
const results = await client.uploadBatch(["./file1.mp4", "./file2.mkv"], callbacks);
```

**Browser client:**
```typescript
// Upload with signed URLs (get these from your backend)
const result = await client.upload(signedUrls, fileInput.files, callbacks);
```

### Search

```typescript
// Basic search
const searchResult = await client.search("cats playing piano", { limit: 5 });
console.log(searchResult.data?.items);

// Search with filters
const filteredSearch = await client.search("action scene", {
  limit: 10,
  object_ids: ["video-id-1", "video-id-2"], // Search within specific videos
  video_id: "specific-video-id" // Search within a single video
});
```

### Get Download URLs

```typescript
// Get multiple download URLs
const result = await client.getDownloadUrls(["object-id-0001", "object-id-0002"]);
console.log(result.data?.urls, result.data?.expires_at);

// Get single download URL  
const singleResult = await client.getDownloadUrl("object-id-0001");
console.log(singleResult.data?.url, singleResult.data?.expires_at);
```

### File Downloads (Backend Only)

```typescript
// Download single file to directory (filename = object ID)
const result = await client.download("object-id", "/path/to/downloads/");

// Download single file to specific path
const result = await client.download("object-id", "/path/to/video.mp4");

// Download multiple files to directory
const result = await client.downloadBatch(
  ["object-id-1", "object-id-2"], 
  "/path/to/downloads/"
);
console.log(result.data?.files); // Array of downloaded file paths
```

### Get Upload URLs (Backend Only)

```typescript
// Get multiple upload URLs
const urls = await client.getUploadUrls(3); // Get 3 URLs
console.log(urls.data); // Array of signed URLs

// Get single upload URL
const singleUrl = await client.getUploadUrl();
console.log(singleUrl.data); // Single signed URL string
```

### WebSocket (Backend Only)

```typescript
const ws = client.listen({
  onOpen: (event) => console.log("Connected"),
  onMessage: (data) => console.log("Message received", data),
  onError: (error) => console.error("WebSocket error", error),
  onClose: (event) => console.log("Disconnected", event.code, event.reason),
});

// WebSocket connection returns a ws instance that you can control
ws.close(); // Close connection when done
```

---

## TypeScript Types

The library exports TypeScript types for better development experience:

```typescript
import type { 
  BackendClientOptions, 
  BrowserClientOptions, 
  ObjectStorageItem, 
  VideoObject 
} from "zapdos-js";

// Use in your application
function handleVideo(video: VideoObject) {
  console.log(video.metadata, video.content?.transcription);
}
```

---

## Contributing

Bug reports and pull requests are welcome!

---

## License

MIT
