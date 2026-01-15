import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranscription } from '@/lib/use-transcription'
import { Mic, MicOff, Volume2, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { TranscriptionResponse } from '@/generated/audio_transcription'

export const Route = createFileRoute('/transcription')({
  component: TranscriptionDemo,
})

function TranscriptionDemo() {
  const {
    transcriptions,
    isStreaming,
    error,
    startStreaming,
    stopStreaming,
    sendAudioChunk,
  } = useTranscription('http://localhost:8080')

  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  // Update connection status based on streaming state
  useEffect(() => {
    if (isStreaming) {
      setConnectionStatus('connected')
    } else if (error) {
      setConnectionStatus('disconnected')
    }
  }, [isStreaming, error])

  // Audio level visualization
  useEffect(() => {
    if (!isRecording || !analyserRef.current) {
      setAudioLevel(0)
      return
    }

    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length
      setAudioLevel(average / 255)
      animationFrameRef.current = requestAnimationFrame(updateLevel)
    }

    updateLevel()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRecording])

  const handleStartRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      mediaStreamRef.current = stream

      // Create audio context (use default sample rate to avoid conflicts)
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const sourceSampleRate = audioContext.sampleRate
      const targetSampleRate = 16000

      // Create analyser for visualization
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      // Create source from stream
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      // Create script processor for audio chunks
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      // Resampling function
      const resample = (input: Float32Array, fromRate: number, toRate: number): Float32Array => {
        if (fromRate === toRate) return input
        const ratio = fromRate / toRate
        const outputLength = Math.round(input.length / ratio)
        const output = new Float32Array(outputLength)
        for (let i = 0; i < outputLength; i++) {
          const index = i * ratio
          const indexFloor = Math.floor(index)
          const indexCeil = Math.min(indexFloor + 1, input.length - 1)
          const fraction = index - indexFloor
          output[i] = input[indexFloor] * (1 - fraction) + input[indexCeil] * fraction
        }
        return output
      }

      processor.onaudioprocess = (e) => {
        if (!isStreaming) return

        const inputData = e.inputBuffer.getChannelData(0)
        
        // Resample to target sample rate if needed
        let processedData = inputData
        if (sourceSampleRate !== targetSampleRate) {
          processedData = resample(inputData, sourceSampleRate, targetSampleRate)
        }

        // Convert Float32Array to Int16Array
        const int16Data = new Int16Array(processedData.length)
        for (let i = 0; i < processedData.length; i++) {
          const s = Math.max(-1, Math.min(1, processedData[i]))
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // Send audio chunk with target sample rate
        sendAudioChunk(int16Data.buffer, targetSampleRate, 1)
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      // Start gRPC streaming
      startStreaming()
      setConnectionStatus('connecting')
      setIsRecording(true)
    } catch (err) {
      console.error('Error accessing microphone:', err)
      setConnectionStatus('disconnected')
      alert('Failed to access microphone. Please check permissions.')
    }
  }

  const handleStopRecording = () => {
    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect()
      analyserRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Stop gRPC streaming
    stopStreaming()
    setIsRecording(false)
    setAudioLevel(0)
    setConnectionStatus('disconnected')
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleStopRecording()
    }
  }, [])

  const fullTranscript = transcriptions
    .map((t) => t.text)
    .join(' ')
    .trim()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-black text-white mb-4 [letter-spacing:-0.08em]">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Audio Transcription
            </span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Real-time speech-to-text transcription powered by Whisper AI
          </p>
        </div>

        {/* Connection Status */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {connectionStatus === 'connected' && (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">Connected</span>
            </>
          )}
          {connectionStatus === 'connecting' && (
            <>
              <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-cyan-400 font-medium">Connecting...</span>
            </>
          )}
          {connectionStatus === 'disconnected' && (
            <>
              <AlertCircle className="w-5 h-5 text-gray-500" />
              <span className="text-gray-500 font-medium">Disconnected</span>
            </>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">Error:</span>
            </div>
            <p className="text-red-300 mt-2">{error.message}</p>
          </div>
        )}

        {/* Control Panel */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 mb-8">
          <div className="flex flex-col items-center gap-6">
            {/* Record Button */}
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={connectionStatus === 'connecting'}
              className={`
                relative w-32 h-32 rounded-full flex items-center justify-center
                transition-all duration-300 transform hover:scale-105
                ${isRecording
                  ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50'
                  : 'bg-cyan-500 hover:bg-cyan-600 shadow-lg shadow-cyan-500/50'
                }
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              `}
            >
              {isRecording ? (
                <MicOff className="w-12 h-12 text-white" />
              ) : (
                <Mic className="w-12 h-12 text-white" />
              )}
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-75" />
              )}
            </button>

            {/* Audio Level Indicator */}
            {isRecording && (
              <div className="w-full max-w-md">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 className="w-4 h-4 text-gray-400" />
                  <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-100"
                      style={{ width: `${audioLevel * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Status Text */}
            <p className="text-gray-400 text-sm">
              {isRecording
                ? 'Recording... Speak into your microphone'
                : 'Click the microphone to start recording'}
            </p>
          </div>
        </div>

        {/* Transcription Display */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            Live Transcription
          </h2>

          {transcriptions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {isRecording
                  ? 'Listening... Speak into your microphone'
                  : 'Start recording to see transcriptions here'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Full Transcript */}
              <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-600">
                <p className="text-white text-lg leading-relaxed whitespace-pre-wrap">
                  {fullTranscript || 'Waiting for transcription...'}
                </p>
              </div>

              {/* Individual Chunks */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                  Transcription Chunks
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {transcriptions.map((transcription: TranscriptionResponse, index: number) => (
                    <div
                      key={index}
                      className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-gray-300 flex-1">{transcription.text}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {transcription.isFinal && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">
                              Final
                            </span>
                          )}
                          {transcription.confidence > 0 && (
                            <span>{(transcription.confidence * 100).toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Make sure the Python backend is running on port 50051 and Envoy proxy on port 8080
          </p>
        </div>
      </div>
    </div>
  )
}

