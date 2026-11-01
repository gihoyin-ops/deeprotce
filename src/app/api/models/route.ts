import { NextResponse } from 'next/server';
import { getLiveModels } from '@/lib/ai/live';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json({ models: getLiveModels() });
}

export async function GET() {
  return NextResponse.json({ models: getLiveModels() });
}
