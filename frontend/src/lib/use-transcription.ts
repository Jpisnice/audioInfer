import { useEffect, useRef, useState, useCallback } from 'react';
import { TranscriptionClient, createAudioChunk } from './grpc-client';
import type { TranscriptionResponse, AudioChunk } from '@/generated/audio_transcription';

/**
 * React hook for audio transcription streaming
 * 
 * @param serviceUrl The gRPC service URL (default: http://localhost:8080)
 * @returns Object with methods to start/stop streaming and current transcriptions
 */
export function useTranscription(serviceUrl?: string) {
  const [transcriptions, setTranscriptions] = useState<TranscriptionResponse[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const clientRef = useRef<TranscriptionClient | null>(null);
  const streamRef = useRef<{ send: (chunk: AudioChunk) => void; close: () => void } | null>(null);

  // Initialize client
  useEffect(() => {
    clientRef.current = new TranscriptionClient(serviceUrl);
    
    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.close();
      }
    };
  }, [serviceUrl]);

  const startStreaming = useCallback(() => {
    if (!clientRef.current) {
      setError(new Error('Client not initialized'));
      return;
    }

    if (streamRef.current) {
      // Already streaming
      return;
    }

    setError(null);
    setIsStreaming(true);
    setTranscriptions([]);

    streamRef.current = clientRef.current.streamTranscribe(
      (response: TranscriptionResponse) => {
        setTranscriptions((prev) => [...prev, response]);
      },
      (err: Error) => {
        setError(err);
        setIsStreaming(false);
        streamRef.current = null;
      }
    );
  }, []);

  const stopStreaming = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const sendAudioChunk = useCallback((
    audioData: Uint8Array | ArrayBuffer | Buffer,
    sampleRate: number = 16000,
    channels: number = 1
  ) => {
    if (!streamRef.current) {
      console.warn('Stream is not active. Call startStreaming() first.');
      return;
    }

    const chunk = createAudioChunk(audioData, sampleRate, channels);
    streamRef.current.send(chunk);
  }, []);

  return {
    transcriptions,
    isStreaming,
    error,
    startStreaming,
    stopStreaming,
    sendAudioChunk,
  };
}

