import { NextRequest, NextResponse } from 'next/server'

const EXTRACTION_URL =
  process.env.PYTHON_EXTRACTION_SERVICE_URL ??
  process.env.EXTRACTION_SERVICE_URL ??
  'http://127.0.0.1:8001'

async function proxy(
  req: NextRequest,
  params: Promise<{ path?: string[] }>,
): Promise<NextResponse> {
  const { path } = await params
  // /api/layout-inspector/...  ->  /inspect/...
  const subPath = (path ?? []).join('/')
  const url = `${EXTRACTION_URL.replace(/\/$/, '')}/inspect/${subPath}`

  const headers: Record<string, string> = {}
  const ct = req.headers.get('content-type')
  if (ct) headers['content-type'] = ct

  const method = req.method
  let body: BodyInit | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    body = await req.arrayBuffer()
    headers['content-length'] = String((body as ArrayBuffer).byteLength)
  }

  const upstream = await fetch(url, {
    method,
    headers,
    body: body as BodyInit | undefined,
    cache: 'no-store',
  }).catch((e) => {
    return new Response(JSON.stringify({ error: `extraction service unreachable: ${e}` }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    }) as unknown as Response
  })

  if (upstream instanceof Response && !('headers' in upstream && typeof upstream.headers.get === 'function')) {
    return NextResponse.json({ error: 'extraction service unreachable' }, { status: 502 })
  }

  const resHeaders = new Headers()
  const upstreamCT = upstream.headers.get('content-type')
  if (upstreamCT) resHeaders.set('content-type', upstreamCT)

  const buf = await upstream.arrayBuffer()
  return new NextResponse(buf, {
    status: upstream.status,
    headers: resHeaders,
  })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx.params)
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx.params)
}
