import type { AssetKind, UploadedAsset } from './types'

const MAX_PDF_PAGES = 300
const MAX_EXTRACTED_CHARS = 250000

function extensionOf(name: string): string {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

export function detectKind(file: File): AssetKind {
  const ext = extensionOf(file.name)
  const mime = file.type.toLowerCase()
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.includes('word') || ext === 'docx' || ext === 'doc') return 'docx'
  if (ext === 'epub') return 'epub'
  if (mime.includes('presentation') || ext === 'pptx' || ext === 'ppt') return 'pptx'
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'wma'].includes(ext)) return 'audio'
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video'
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return 'image'
  if (['txt', 'md', 'markdown', 'csv', 'json', 'srt', 'vtt'].includes(ext)) return 'text'
  return 'unknown'
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS)
}

async function parsePdf(file: File): Promise<string> {
  const { getDocument } = await import('pdfjs-dist')
  const { GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  const data = await file.arrayBuffer()
  const loadingTask = getDocument({ data })
  const doc = await loadingTask.promise
  const pages: string[] = []
  const count = Math.min(doc.numPages, MAX_PDF_PAGES)
  for (let i = 1; i <= count; i++) {
    try {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
      pages.push(text)
    } catch {
      pages.push('')
    }
  }
  await loadingTask.destroy()
  return cleanText(pages.join('\n\n'))
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return cleanText(result.value)
}

async function stripXml(xml: string): Promise<string> {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

async function parseEpub(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir && /\.(xhtml|html|htm)$/i.test(entry.name))
    .filter((entry) => !/nav|toc|cover/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
  const parts: string[] = []
  for (const entry of entries) {
    try {
      const content = await entry.async('string')
      parts.push(await stripXml(content))
    } catch {
      parts.push('')
    }
  }
  return cleanText(parts.join('\n\n'))
}

async function parsePptx(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir && /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
    .sort((a, b) => {
      const na = parseInt(a.name.match(/(\d+)/)?.[1] ?? '0', 10)
      const nb = parseInt(b.name.match(/(\d+)/)?.[1] ?? '0', 10)
      return na - nb
    })
  const parts: string[] = []
  for (const entry of entries) {
    try {
      const content = await entry.async('string')
      parts.push(await stripXml(content))
    } catch {
      parts.push('')
    }
  }
  return cleanText(parts.join('\n\n'))
}

function audioMetadata(file: File): Promise<{ durationSec?: number }> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const el = new Audio()
      el.preload = 'metadata'
      el.onloadedmetadata = () => {
        const durationSec = isFinite(el.duration) ? el.duration : undefined
        URL.revokeObjectURL(url)
        resolve({ durationSec })
      }
      el.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({})
      }
      el.src = url
    } catch {
      resolve({})
    }
  })
}

function videoMetadata(file: File): Promise<{ durationSec?: number }> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const el = document.createElement('video')
      el.preload = 'metadata'
      el.onloadedmetadata = () => {
        const durationSec = isFinite(el.duration) ? el.duration : undefined
        URL.revokeObjectURL(url)
        resolve({ durationSec })
      }
      el.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({})
      }
      el.src = url
    } catch {
      resolve({})
    }
  })
}

export function fakeContent(name: string): string {
  return cleanText(
    [
      name.replace(/\.pdf$/i, ''),
      '',
      'This is a sample course material file. Chapter One: Introduction and greetings, basic vocabulary, simple phrases, hello, goodbye, thank you.',
      'Chapter Two: Numbers, dates, time expressions, days of the week, months of the year.',
      'Chapter Three: Grammar focus on present tense, verbs, conjugations, sentence structure, questions, negation.',
      'Chapter Four: Everyday conversations, dialogues, asking for directions, ordering food, shopping.',
      'Exercise 1: Match the vocabulary with the meaning. Exercise 2: Fill in the blanks with the correct verb form. Exercise 3: Answer the questions in complete sentences.',
    ].join('\n\n')
  )
}

export async function parseAsset(file: File): Promise<UploadedAsset> {
  const kind = detectKind(file)
  const base: UploadedAsset = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    kind,
    mime: file.type,
    size: file.size,
  }
  try {
    if (kind === 'pdf') {
      base.text = await parsePdf(file)
    } else if (kind === 'docx') {
      base.text = await parseDocx(file)
    } else if (kind === 'epub') {
      base.text = await parseEpub(file)
    } else if (kind === 'pptx') {
      base.text = await parsePptx(file)
    } else if (kind === 'text') {
      base.text = cleanText(await file.text())
    } else if (kind === 'audio') {
      const meta = await audioMetadata(file)
      base.durationSec = meta.durationSec
    } else if (kind === 'video') {
      const meta = await videoMetadata(file)
      base.durationSec = meta.durationSec
    }
  } catch {
    base.text = undefined
  }
  if (base.text) {
    base.words = base.text.split(/\s+/).filter(Boolean).length
  }
  return base
}

export function isFake(file: File): boolean {
  return file.size === 0 && file.type === ''
}
