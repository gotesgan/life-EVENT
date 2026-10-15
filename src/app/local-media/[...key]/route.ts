import { NextResponse, type NextRequest } from 'next/server';
import { isLocalStorageActive, readLocalObject } from '@/lib/storage';

/**
 * Serves objects written by the local storage driver, so listing media renders
 * in development and tests without any cloud credentials. Not available in
 * production, where media is served from the R2 public domain.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
  if (!isLocalStorageActive()) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Not found' } },
      { status: 404 },
    );
  }

  const { key } = await context.params;
  const objectKey = (key ?? []).join('/');

  if (!objectKey) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'A key is required' } },
      { status: 400 },
    );
  }

  const object = await readLocalObject(objectKey);
  if (!object) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Not found' } },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(object.bytes), {
    status: 200,
    headers: {
      'Content-Type': object.contentType,
      // Local objects are immutable: the key encodes a content hash.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
