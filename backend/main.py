import whisper
import pyaudio
import numpy as np
import threading
from queue import Queue

# Configuration
CHUNK = 1024
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
RECORD_SECONDS = 4  # Process audio every 4 seconds

# Load Whisper model (use "base", "small", "medium", or "large")
model = whisper.load_model("base.en")

# Audio queue for processing
audio_queue = Queue()

def audio_callback(in_data, frame_count, time_info, status):
    """Callback function for audio stream"""
    audio_queue.put(in_data)
    return (in_data, pyaudio.paContinue)

def transcribe_audio():
    """Process audio chunks and transcribe"""
    frames = []
    
    while True:
        # Collect audio for specified duration
        chunks_needed = int(RATE / CHUNK * RECORD_SECONDS)
        
        for _ in range(chunks_needed):
            if not audio_queue.empty():
                frames.append(audio_queue.get())
        
        if len(frames) >= chunks_needed:
            # Convert to numpy array
            audio_data = b''.join(frames)
            audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            
            # Transcribe
            result = model.transcribe(audio_np, language="en", fp16=False)
            
            if result["text"].strip():
                print(f"Transcription: {result['text']}")
            
            # Clear processed frames
            frames = []

def main():
    # Initialize PyAudio
    p = pyaudio.PyAudio()
    
    # Open audio stream
    stream = p.open(
        format=FORMAT,
        channels=CHANNELS,
        rate=RATE,
        input=True,
        frames_per_buffer=CHUNK,
        stream_callback=audio_callback
    )
    
    print("Starting live transcription... Speak into your microphone.")
    stream.start_stream()
    
    # Start transcription thread
    transcribe_thread = threading.Thread(target=transcribe_audio, daemon=True)
    transcribe_thread.start()
    
    try:
        while stream.is_active():
            pass
    except KeyboardInterrupt:
        print("\nStopping transcription...")
        stream.stop_stream()
        stream.close()
        p.terminate()

if __name__ == "__main__":
    main()