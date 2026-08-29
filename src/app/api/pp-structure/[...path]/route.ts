import { NextRequest, NextResponse } from 'next/server'

// PP-Structure Inspector — advanced document structure (PaddleOCR PP-StructureV3)
// Stateless: every request hits pp-structure-service:8005 with LAYOUT_FORCE_PROVIDER=paddle_structure
// No fallback — forced engine must be used for valid benchmark
const EXTRACTION_URL =
  process.env.PP_STRUCTURE_SERVICE_URL ??
  process.env.PPSTRUCTURE_SERVICE_URL ??
  'http://127.0.0.1:8005'

async function proxy(
  req: NextRequest,
  params: Promise<{ path?: string[] }>,
): Promise<NextResponse> {
  const { path } = await params
  const subPath = (path ?? []).join('/')
  const url = `${EXTRACTION_URL.replace(/\/$/, '')}/${subPath}`

  const headers: Record<string, string> = {}
  const ct = req.headers.get('content-type')
  if (ct) headers['content-type'] = ct

  const method = req.method
  let body: BodyInit | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    const ab = await req.arrayBuffer()
    if (ab.byteLength > 0) {
      body = ab
      headers['content-length'] = String(ab.byteLength)
    }
  }

  const upstream = await fetch(url, {
    method,
    headers,
    body: body as BodyInit | undefined,
    cache: 'no-store',
  }).catch((e) => {
    return new Response(JSON.stringify({ error: `pp-structure service unreachable: ${e}`, service: 'pp-structure', url }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    }) as unknown as Response
  })

  if (!upstream || typeof (upstream as Response).headers?.get !== 'function') {
    return NextResponse.json({ error: 'pp-structure service unreachable' }, { status: 502 })
  }

  const resHeaders = new Headers()
  const upstreamCT = (upstream as Response).headers.get('content-type')
  if (upstreamCT) resHeaders.set('content-type', upstreamCT)

  const buf = await (upstream as Response).arrayBuffer()
  return new NextResponse(buf, {
    status: (upstream as Response).status,
    headers: resHeaders,
  })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx.params)
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx.params)
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx.params)
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx.params)
}
