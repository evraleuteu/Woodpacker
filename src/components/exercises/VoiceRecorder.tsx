'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Trash2 } from 'lucide-react'

interface VoiceRecorderProps {
  disabled?: boolean
  onReadyChange?: (ready: boolean) => void
  onUnavailable?: () => void
}

export function VoiceRecorder({ disabled = false, onReadyChange, onUnavailable }: VoiceRecorderProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'recorded'>('idle')
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const urlRef = useRef<string | null>(null)

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    []
  )

  const start = async () => {
    if (disabled || status !== 'idle') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = URL.createObjectURL(blob)
        setBlobUrl(urlRef.current)
        setStatus('recorded')
        onReadyChange?.(true)
      }
      recorderRef.current = rec
      rec.start()
      setStatus('recording')
    } catch {
      setStatus('idle')
      onUnavailable?.()
    }
  }

  const stop = () => recorderRef.current?.stop()

  const reset = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setBlobUrl(null)
    setStatus('idle')
    onReadyChange?.(false)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {status === 'recorded' && blobUrl && (
        <div className="w-full flex items-center gap-3">
          <audio src={blobUrl} controls className="flex-1 h-10 rounded-lg" />
          <button
            type="button"
            onClick={reset}
            disabled={disabled}
            aria-label="Re-record"
            className="w-10 h-10 shrink-0 rounded-full border border-[var(--color-border)] bg-[rgba(250,248,245,0.03)] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] transition-all"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={status === 'recording' ? stop : start}
        disabled={disabled || status === 'recorded'}
        aria-label={status === 'recording' ? 'Stop recording' : 'Start recording'}
        className={`w-16 h-16 rounded-full flex items-center justify-center text-white transition-all ${
          status === 'recording'
            ? 'bg-[#EF4444] animate-pulse shadow-[0_0_28px_rgba(239,68,68,0.5)]'
            : status === 'recorded'
              ? 'bg-[var(--color-success)] shadow-[0_0_24px_rgba(16,185,129,0.35)]'
              : 'bg-[var(--color-primary)] shadow-lg hover:shadow-[0_0_24px_rgba(16,185,129,0.45)] hover:scale-105 active:scale-95'
        } disabled:opacity-30 disabled:cursor-default`}
      >
        {status === 'recording' ? <Square size={22} fill="currentColor" /> : <Mic size={24} />}
      </button>
      <p className="text-xs text-[var(--color-muted)]">
        {status === 'recording'
          ? 'Recording… tap to stop'
          : status === 'recorded'
            ? 'Recording ready — press Check when done'
            : 'Tap the microphone and speak your answer'}
      </p>
    </div>
  )
}