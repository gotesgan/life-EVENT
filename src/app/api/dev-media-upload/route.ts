import { NextResponse, type NextRequest } from 'next/server';
import { isLocalStorageActive, writeLocalObject } from '@/lib/storage';

/**
 * Development/only upload target used by the local storage driver's presigned
 * URL. In production the browser uploads straight to Cloudflare R2 with a real
 * presigned URL and this route does not exist.
 *
 * It deliberately mirrors the constraints of the R2 presign — single object key
 * from the query string, declared content type — and rejects anything the
 * storage validation layer would not accept.
 */

/**
 * The route exists exactly when the local storage driver is the active store —
 * see `isLocalStorageActive()`. Gating on `NODE_ENV` meant the documented
 * presign → PUT → complete flow could not be exercised against a production
 * build, which is how end-to-end tests run.
 */
function isEnabled(): boolean {
  return isLocalStorageActive();
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!isEnabled()) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Not found' } },
      { status: 404 },
    );
  }

  const key = request.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'A key is required' } },
      { status: 400 },
    );
  }

  const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
  const bytes = new Uint8Array(await request.arrayBuffer());

  if (bytes.byteLength === 0) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'The uploaded file is empty' } },
      { status: 400 },
    );
  }

  try {
    await writeLocalObject(key, bytes, contentType);
  } catch (error) {
    // Surface the traversal guard as a client error rather than a 500.
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message } }, { status: 400 });
  }

  return NextResponse.json({ ok: true, key, sizeBytes: bytes.byteLength });
}
