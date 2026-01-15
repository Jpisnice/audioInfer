/**
 * Example usage of the gRPC transcription client
 * 
 * This file demonstrates how to use the transcription client in a React component.
 * You can copy this pattern into your own components.
 */

import { useTranscription } from './use-transcription';

export function TranscriptionExample() {
  const {
    transcriptions,
    isStreaming,
    error,
    startStreaming,
    stopStreaming,
    sendAudioChunk,
  } = useTranscription('http://localhost:8080'); // Adjust URL as needed

  // Example: Start streaming when component mounts
  // useEffect(() => {
  //   startStreaming();
  //   return () => stopStreaming();
  // }, [startStreaming, stopStreaming]);

  // Example: Capture audio from microphone and send chunks
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      startStreaming();

      processor.onaudioprocess = (e) => {
        if (!isStreaming) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32Array to Int16Array
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send audio chunk
        sendAudioChunk(int16Data.buffer, audioContext.sampleRate, 1);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  return (
    <div>
      <h2>Audio Transcription</h2>
      
      {error && <div style={{ color: 'red' }}>Error: {error.message}</div>}
      
      <div>
        <button onClick={startStreaming} disabled={isStreaming}>
          Start Streaming
        </button>
        <button onClick={stopStreaming} disabled={!isStreaming}>
          Stop Streaming
        </button>
      </div>

      <div>
        <h3>Transcriptions:</h3>
        <ul>
          {transcriptions.map((t, i) => (
            <li key={i}>
              {t.text} {t.isFinal ? '(Final)' : '(Interim)'} - Confidence: {t.confidence}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

