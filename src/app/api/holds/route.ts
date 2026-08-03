import { NextRequest, NextResponse } from 'next/server';
import { proxyFetch } from '@/lib/api';
import { HoldsResponseSchema } from '@/types/api';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const url = qs ? `/holds?${qs}` : '/holds';

  try {
    const raw = await proxyFetch(req, url, { method: 'GET' });
    const parsed = HoldsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid response from backend' }, { status: 502 });
    }
    return NextResponse.json(parsed.data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    if (status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Service unavailable' }, { status: 502 });
  }
}
