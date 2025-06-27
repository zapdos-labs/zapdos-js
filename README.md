# zapdos-js

A simple Javascript library.

## Installation

```bash
npm install zapdos-js
```

## Usage

```javascript
import { ZapdosClient } from 'zapdos-js';

const client = new ZapdosClient('YOUR_API_KEY');

// Example: Upload a video
// client.uploadVideo('./path/to/your/video.mp4')
//   .then(result => console.log('Upload complete:', result))
//   .catch(error => console.error('Upload failed:', error));

// Example: Request an upload token
// client.requestUploadToken()
//   .then(result => console.log('Upload token:', result))
//   .catch(error => console.error('Token request failed:', error));

// Example: Get job status
// client.getJobStatus('YOUR_JOB_ID')
//   .then(result => console.log('Job status:', result))
//   .catch(error => console.error('Get job status failed:', error));

// Example: Health check
// client.healthCheck()
//   .then(result => console.log('Health check:', result))
//   .catch(error => console.error('Health check failed:', error));
```

## Available Methods

- `uploadVideo(filePath: string)`: Uploads a video file to Zapdos Storage.
- `requestUploadToken()`: Requests a short-lived upload token.
- `getJobStatus(jobId: string)`: Retrieves the status of an indexing job.
- `healthCheck()`: Checks the health of the Zapdos API.

## Development

If you are developing `zapdos-js`, you will need to rebuild the project after making changes to the TypeScript source files. You can do this by running:

```bash
npm run build
```

For continuous development, you can use `tsc --watch` to automatically recompile on file changes:

```bash
tsc --watch
```
