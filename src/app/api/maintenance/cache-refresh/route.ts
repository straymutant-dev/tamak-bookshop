import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_ROUTES = ['/', '/store', '/about', '/terms', '/privacy'];

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');

  if (!secret || authorization !== 'Bearer ' + secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const healthChecks: Array<{ path: string; status: number }> = [];

  for (const path of PUBLIC_ROUTES) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        cache: 'no-store',
        headers: { 'x-cache-refresh-check': 'weekly-maintenance' },
        signal: AbortSignal.timeout(15_000),
      });
      healthChecks.push({ path, status: response.status });

      if (!response.ok) {
        return NextResponse.json(
          { refreshed: false, reason: 'public route health check failed', healthChecks },
          { status: 502 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          refreshed: false,
          reason: error instanceof Error ? error.message : 'public route health check failed',
          healthChecks,
        },
        { status: 502 }
      );
    }
  }

  for (const path of PUBLIC_ROUTES) {
    revalidatePath(path);
  }

  revalidatePath('/', 'layout');

  return NextResponse.json({
    refreshed: true,
    checkedAt: new Date().toISOString(),
    healthChecks,
    revalidatedRoutes: PUBLIC_ROUTES,
  });
}
