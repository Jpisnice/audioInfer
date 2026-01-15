// Import grpc-web - handle CommonJS module
// Use namespace import which works better with Vite's CommonJS interop
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as grpcWebModule from '@improbable-eng/grpc-web';
// Extract grpc from the module (it may be at grpcWebModule.grpc or grpcWebModule.default.grpc)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const grpc = (grpcWebModule as any).grpc || ((grpcWebModule as any).default && (grpcWebModule as any).default.grpc) || grpcWebModule;
import { AudioChunk, TranscriptionResponse, AudioChunk as AudioChunkType } from '@/generated/audio_transcription';
import { BinaryWriter } from '@bufbuild/protobuf/wire';

// gRPC status codes (Code.OK = 0)
const GRPC_CODE_OK = 0;

/**
 * gRPC client for audio transcription service
 * 
 * Note: This uses @improbable-eng/grpc-web which supports bidirectional streaming
 * via WebSockets. Make sure your backend has a grpc-web proxy (like Envoy) configured
 * to handle WebSocket connections, or use a WebSocket-enabled gRPC gateway.
 * 
 * For standard HTTP/2 gRPC, you'll need a proxy that converts gRPC to grpc-web.
 */
export class TranscriptionClient {
  private serviceUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;

  constructor(serviceUrl: string = 'http://localhost:8080') {
    this.serviceUrl = serviceUrl;
  }

  /**
   * Stream audio chunks and receive transcription responses
   * 
   * @param onResponse Callback for each transcription response
   * @param onError Callback for errors
   * @returns An object with methods to send audio chunks and close the stream
   */
  streamTranscribe(
    onResponse: (response: TranscriptionResponse) => void,
    onError: (error: Error) => void
  ): {
    send: (chunk: AudioChunkType) => void;
    close: () => void;
  } {
    // Create a bidirectional stream using WebSocket transport
    // We use 'any' to bypass type checking since we handle encoding/decoding manually
    // with @bufbuild/protobuf instead of the ProtobufMessage interface expected by grpc-web
    
    // Ensure serviceUrl starts with http:// or https://
    const serviceUrl = this.serviceUrl.startsWith('http://') || this.serviceUrl.startsWith('https://') 
      ? this.serviceUrl 
      : `http://${this.serviceUrl}`;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const websocketTransport = (grpc as any).WebsocketTransport;
    if (!websocketTransport) {
      onError(new Error('WebsocketTransport is not available in grpc-web module'));
      return { send: () => {}, close: () => {} };
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.client = (grpc.client as any)(
      {
        service: 'transcription.TranscriptionService',
        method: 'StreamTranscribe',
        host: serviceUrl,
      },
      {
        // WebSocketTransport constructor needs host parameter
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transport: websocketTransport({ host: serviceUrl }),
      }
    );

    // Handle responses - decode from Uint8Array to TranscriptionResponse
    this.client.onMessage((messageBytes: Uint8Array) => {
      const response = TranscriptionResponse.decode(messageBytes);
      onResponse(response);
    });

    // Handle errors and stream end
    this.client.onEnd((status: number, statusMessage: string) => {
      if (status !== GRPC_CODE_OK) {
        onError(new Error(`gRPC error: ${status} - ${statusMessage}`));
      }
      this.client = null;
    });

    // Start the stream
    this.client.start();

    return {
      send: (chunk: AudioChunkType) => {
        if (!this.client) {
          throw new Error('Stream is not active');
        }
        // Encode the AudioChunk message to Uint8Array
        const writer = new BinaryWriter();
        AudioChunk.encode(chunk, writer);
        const encoded = writer.finish();
        this.client.send(encoded);
      },
      close: () => {
        if (this.client) {
          this.client.finishSend();
          this.client.close();
          this.client = null;
        }
      },
    };
  }
}

/**
 * Helper function to create an AudioChunk from raw audio data
 */
export function createAudioChunk(
  audioData: Uint8Array | ArrayBuffer | Buffer,
  sampleRate: number = 16000,
  channels: number = 1
): AudioChunkType {
  let buffer: Buffer;
  
  if (audioData instanceof Buffer) {
    buffer = audioData;
  } else if (audioData instanceof ArrayBuffer) {
    buffer = Buffer.from(audioData);
  } else {
    buffer = Buffer.from(audioData);
  }
  
  return AudioChunk.create({
    audioData: buffer,
    sampleRate,
    channels,
  });
}

