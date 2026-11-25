import { NextResponse } from 'next/server';
import {
  fetchRelayModels,
  relayErrorResponse,
  resolveRelayClientId,
} from '@/lib/ai/live';
import { isAiLogEnabled } from '@/lib/ai/ai-logs';
import { isGuestRequest } from '@/lib/security/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (isGuestRequest(req.headers)) {
    return NextResponse.json({
      default: 'auto',
      models: [
        {
          id: 'auto',
          name: 'Auto',
          description: 'Sign in to choose models',
          maxTierIndex: 1
        }
      ]
    });
  }

  try {
    const clientId = resolveRelayClientId(req);
    const result = await fetchRelayModels(clientId);

    if (!result.ok) {
      if (isAiLogEnabled()) {
        console.error(`[live-models] relay returned ${result.status}`);
      }
      return relayErrorResponse(result.status, result.headers);
    }

    return NextResponse.json({
      default: result.defaultId,
      models: result.models,
    });
  } catch (error) {
    if (isAiLogEnabled()) {
      console.error(`[live-models] relay error: ${error instanceof Error ? error.message : 'unknown'}`);
    }
    return relayErrorResponse(502);
  }
}
