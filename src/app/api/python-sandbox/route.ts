import { NextResponse } from 'next/server';
import { buildPythonSandboxHtml } from '@/lib/code/python-runtime';

export const runtime = 'nodejs';

export async function GET() {
  const html = buildPythonSandboxHtml();
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
