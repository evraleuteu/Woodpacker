import { NextRequest, NextResponse } from 'next/server'
import { detectLayoutWithDocAI, extractTextWithDocAI, getDocAIStatus } from '@/lib/document-understanding/providers/google-docai'

export async function GET(): Promise<NextResponse> {
  const status = getDocAIStatus()
  if (!status.available) {
    return NextResponse.json(
      { error: 'Google Document AI not configured', reason: status.reason },
      { status: 503 }
    )
  }
  return NextResponse.json({ status: 'available', processors: ['ocr', 'layout'] })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const status = getDocAIStatus()
  if (!status.available) {
    return NextResponse.json(
      { error: 'Google Document AI not configured', reason: status.reason },
      { status: 503 }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const processor = (formData.get('processor') as string) || 'layout'
    const pageWidth = parseInt(formData.get('pageWidth') as string || '2480', 10)
    const pageHeight = parseInt(formData.get('pageHeight') as string || '3508', 10)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const mimeType = file.type || 'application/pdf'

    if (processor === 'ocr') {
      const result = await extractTextWithDocAI(buffer, mimeType)
      return NextResponse.json({ success: true, processor: 'ocr', ...result })
    } else if (processor === 'layout') {
      const regions = await detectLayoutWithDocAI(buffer, mimeType, pageWidth, pageHeight)
      return NextResponse.json({ success: true, processor: 'layout', regions, pageWidth, pageHeight })
    } else {
      return NextResponse.json({ error: 'Invalid processor. Use "ocr" or "layout"' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Google Document AI processing error:', error)
    return NextResponse.json(
      { error: 'Google Document AI processing failed', reason: error.message, provider: 'google-docai' },
      { status: 500 }
    )
  }
}