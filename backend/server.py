import grpc
from concurrent import futures
import numpy as np
import whisper
import time
import io
import wave
from queue import Queue
import threading

# Import generated protobuf files
import audio_transcription_pb2
import audio_transcription_pb2_grpc


class TranscriptionServicer(audio_transcription_pb2_grpc.TranscriptionServiceServicer):
    def __init__(self):
        print("Loading Whisper model...")
        self.model = whisper.load_model("base.en")
        print("Model loaded!")
    
    def StreamTranscribe(self, request_iterator, context):
        """Handle bidirectional streaming for real-time transcription"""
        audio_buffer = []
        buffer_duration = 0
        target_duration = 3.0  # Process every 3 seconds
        
        sample_rate = 16000
        channels = 1
        
        print("Client connected, starting transcription stream...")
        
        try:
            for audio_chunk in request_iterator:
                # Update audio parameters from first chunk
                if audio_chunk.sample_rate > 0:
                    sample_rate = audio_chunk.sample_rate
                if audio_chunk.channels > 0:
                    channels = audio_chunk.channels
                
                # Add audio data to buffer
                audio_buffer.append(audio_chunk.audio_data)
                
                # Calculate buffer duration
                total_bytes = sum(len(chunk) for chunk in audio_buffer)
                bytes_per_sample = 2  # 16-bit audio
                total_samples = total_bytes // (bytes_per_sample * channels)
                buffer_duration = total_samples / sample_rate
                
                # Process when buffer reaches target duration
                if buffer_duration >= target_duration:
                    # Concatenate audio data
                    audio_data = b''.join(audio_buffer)
                    
                    # Convert to numpy array for Whisper
                    audio_np = np.frombuffer(audio_data, dtype=np.int16)
                    
                    # Handle stereo to mono conversion
                    if channels == 2:
                        audio_np = audio_np.reshape(-1, 2).mean(axis=1)
                    
                    # Normalize to float32
                    audio_np = audio_np.astype(np.float32) / 32768.0
                    
                    # Resample if needed (Whisper expects 16kHz)
                    if sample_rate != 16000:
                        # Simple resampling (for production, use librosa)
                        audio_np = self._resample(audio_np, sample_rate, 16000)
                    
                    # Transcribe
                    result = self.model.transcribe(
                        audio_np,
                        language="en",
                        fp16=False,
                        task="transcribe"
                    )
                    
                    # Send response if text is not empty
                    if result["text"].strip():
                        response = audio_transcription_pb2.TranscriptionResponse(
                            text=result["text"].strip(),
                            is_final=True,
                            confidence=1.0,
                            timestamp=int(time.time() * 1000)
                        )
                        print(f"Transcription: {result['text'].strip()}")
                        yield response
                    
                    # Clear buffer
                    audio_buffer = []
                    buffer_duration = 0
        
        except Exception as e:
            print(f"Error in transcription stream: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
        
        print("Client disconnected")
    
    def _resample(self, audio, orig_sr, target_sr):
        """Simple resampling (for production use librosa.resample)"""
        duration = len(audio) / orig_sr
        target_length = int(duration * target_sr)
        indices = np.linspace(0, len(audio) - 1, target_length)
        return np.interp(indices, np.arange(len(audio)), audio)


def serve():
    # Create gRPC server
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    
    # Add servicer to server
    audio_transcription_pb2_grpc.add_TranscriptionServiceServicer_to_server(
        TranscriptionServicer(), server
    )
    
    # Listen on port 50051
    server.add_insecure_port('[::]:50051')
    
    print("Starting gRPC server on port 50051...")
    server.start()
    print("Server is running and ready to accept connections")
    
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.stop(0)


if __name__ == '__main__':
    serve()