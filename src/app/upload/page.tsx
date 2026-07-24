'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

const examples = [
  { label: 'German A1 Textbook', icon: '📚', desc: 'PDF textbook', languages: 'German' },
  { label: 'French Dialogues', icon: '🎵', desc: 'Audio course', languages: 'French' },
  { label: 'Spanish Vocabulary', icon: '📄', desc: 'Word list', languages: 'Spanish' },
  { label: 'Italian Grammar Notes', icon: '📝', desc: 'Study notes', languages: 'Italian' },
]

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles((prev) => [...prev, ...droppedFiles])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = () => {
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      setFiles([])
    }, 2000)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Upload Language Material</h1>
        <p className="text-muted text-sm mt-1">
          Upload your textbook, PDF, audio course, or notes. AI extracts vocabulary, grammar, dialogues, and generates
          complete mastery exercises.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
        className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
          dragging
            ? 'border-wood-500 bg-wood-600/5'
            : 'border-border hover:border-wood-500/50 bg-surface'
        }`}
      >
        <div className="text-4xl mb-3">↑</div>
        <h3 className="text-lg font-semibold mb-1">
          {dragging ? 'Drop your files here' : 'Upload your language material'}
        </h3>
        <p className="text-sm text-muted mb-2">Drag & drop or click to browse</p>
        <p className="text-xs text-muted">PDF, EPUB, DOCX, MP3, WAV, M4A, TXT, Markdown — all language formats supported</p>
        <input
          id="file-input"
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">{files.length} file(s) selected</h3>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                uploading
                  ? 'bg-wood-600/50 text-white cursor-not-allowed'
                  : 'bg-wood-600 hover:bg-wood-500 text-white'
              }`}
            >
              {uploading ? 'Analyzing...' : 'Upload & Analyze'}
            </button>
          </div>
          <div className="space-y-2">
            {files.map((file, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-lighter text-sm">
                <div className="flex items-center gap-3">
                  <span>
                    {file.type.startsWith('audio/') ? '🎵' : file.type.includes('pdf') ? '📄' : '📁'}
                  </span>
                  <div>
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted ml-2">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </div>
                </div>
                <button onClick={() => removeFile(i)} className="text-muted hover:text-red-400 transition-colors">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Example Uploads */}
      <div className="mt-8 rounded-xl border border-border bg-surface p-5">
        <h3 className="font-semibold text-sm mb-3">Try uploading something like</h3>
        <div className="grid grid-cols-4 gap-3">
          {examples.map((ex) => (
            <button
              key={ex.label}
              className="p-3 rounded-lg bg-surface-lighter border border-border text-left hover:border-wood-500/30 transition-all"
            >
              <span className="text-lg">{ex.icon}</span>
              <div className="text-sm font-medium mt-1">{ex.label}</div>
              <div className="text-xs text-muted">{ex.languages}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Knowledge Mastery Premium Teaser */}
      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-600/5 p-4 flex items-center gap-3">
        <span className="text-lg">🧠</span>
        <div>
          <div className="text-sm font-medium">Knowledge Mastery — Coming Soon</div>
          <div className="text-xs text-muted">Upload medical, engineering, or law textbooks for recall systems.</div>
        </div>
        <span className="text-xs text-amber-400 ml-auto">Premium Feature</span>
      </div>
    </div>
  )
}