import type { Config, Context } from '@netlify/edge-functions'

/**
 * Same-origin proxy to the MyEzvizCam Pro Python backend.
 *
 * The backend issues `session_id` as an `HttpOnly; SameSite=Strict` cookie, so the
 * browser only sends it back when the UI and the API share one origin. This edge
 * function forwards every `/api/v1/*` request to `EZVIZ_BACKEND_URL` (for example a
 * Cloudflare Tunnel / Tailscale Funnel URL in front of `python services/api/main.py`)
 * and streams the response — including MJPEG live streams and HTTP Range playback —
 * back untouched.
 *
 * When `EZVIZ_BACKEND_URL` is not set the proxy answers 503 BACKEND_NOT_CONFIGURED,
 * which tells the UI to switch to its built-in demo mode.
 */

const HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  // Let the runtime negotiate compression so the body and headers stay consistent.
  'accept-encoding',
]

export default async (req: Request, _context: Context) => {
  const backend = Netlify.env.get('EZVIZ_BACKEND_URL')
  if (!backend) {
    return Response.json(
      {
        ok: false,
        error: 'BACKEND_NOT_CONFIGURED',
        detail: 'EZVIZ_BACKEND_URL is not set; the UI runs in demo mode.',
      },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }

  const incoming = new URL(req.url)
  const target = new URL(incoming.pathname + incoming.search, backend)

  const headers = new Headers(req.headers)
  for (const h of HOP_BY_HOP) headers.delete(h)
  headers.set('x-forwarded-host', incoming.host)
  headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''))

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: 'manual',
    })
  } catch {
    return Response.json(
      {
        ok: false,
        error: 'BACKEND_UNREACHABLE',
        detail: 'Không thể kết nối tới máy chủ camera.',
      },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    )
  }

  const out = new Headers(upstream.headers)
  for (const h of ['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length']) {
    if (h.startsWith('content-') && !upstream.headers.get('content-encoding')) continue
    out.delete(h)
  }
  out.set('cache-control', out.get('cache-control') ?? 'no-store')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  })
}

export const config: Config = {
  path: '/api/v1/*',
}
