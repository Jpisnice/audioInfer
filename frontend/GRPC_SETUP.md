# gRPC Setup for Frontend

This document explains how to use gRPC in the TypeScript frontend.

## Generated Files

The proto files are automatically generated from `protos/audio_transcription.proto` into `src/generated/`.

## Usage

### 1. Generate TypeScript files from proto

```bash
pnpm run gen:proto
```

This will generate TypeScript types and message encoders/decoders in `src/generated/audio_transcription.ts`.

### 2. Use the Transcription Client

#### Option A: Using the React Hook (Recommended)

```tsx
import { useTranscription } from '@/lib/use-transcription';

function MyComponent() {
  const {
    transcriptions,
    isStreaming,
    error,
    startStreaming,
    stopStreaming,
    sendAudioChunk,
  } = useTranscription('http://localhost:8080');

  // Start streaming
  useEffect(() => {
    startStreaming();
    return () => stopStreaming();
  }, [startStreaming, stopStreaming]);

  // Send audio chunks
  const handleAudioData = (audioData: ArrayBuffer) => {
    sendAudioChunk(audioData, 16000, 1);
  };

  return (
    <div>
      {transcriptions.map((t, i) => (
        <div key={i}>{t.text}</div>
      ))}
    </div>
  );
}
```

#### Option B: Using the Client Directly

```tsx
import { TranscriptionClient, createAudioChunk } from '@/lib/grpc-client';

const client = new TranscriptionClient('http://localhost:8080');

const stream = client.streamTranscribe(
  (response) => {
    console.log('Transcription:', response.text);
  },
  (error) => {
    console.error('Error:', error);
  }
);

// Send audio chunks
const chunk = createAudioChunk(audioData, 16000, 1);
stream.send(chunk);

// Close when done
stream.close();
```

## Important Notes

1. **gRPC-Web Proxy Required**: For bidirectional streaming, you need a gRPC-Web proxy (like Envoy) that supports WebSockets, or use a WebSocket-enabled gRPC gateway.

2. **Backend Configuration**: Make sure your backend gRPC server is accessible via the proxy at the specified URL.

3. **CORS**: Ensure CORS is properly configured on your gRPC-Web proxy to allow requests from your frontend origin.

## Dependencies

- `ts-proto`: Generates TypeScript types from proto files
- `@bufbuild/protobuf`: Protocol buffer runtime
- `@improbable-eng/grpc-web`: gRPC-Web client with WebSocket support
- `grpc-web`: Standard gRPC-Web client (also installed)

## Regenerating Proto Files

If you update the `audio_transcription.proto` file, run:

```bash
pnpm run gen:proto
```

The generated files will be updated in `src/generated/`.

