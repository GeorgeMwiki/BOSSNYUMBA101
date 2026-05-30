import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * /api/pilot-apply — Next route handler that forwards a validated
 * pilot application to the BossNyumba api-gateway.
 *
 * Validation lives here (zod) — we never proxy raw user input
 * unchecked. Errors return RFC 7807-shaped envelopes so the form can
 * surface them to the operator.
 *
 * Real-estate domain fields (landlord_name, portfolio_size, etc.) are
 * captured at this layer; the gateway forwards them into the LMBM
 * pilot pipeline.
 */
const ApplicationSchema = z.object({
  landlordName: z.string().min(2).max(120),
  company: z.string().min(2).max(160).optional(),
  email: z.string().email().max(160),
  phone: z.string().min(6).max(30),
  portfolioSize: z.number().int().min(1).max(10_000),
  propertyType: z.enum([
    'apartment',
    'townhouse',
    'mixed-use',
    'commercial',
    'mixed-residential',
    'cooperative-housing',
  ]),
  currentPms: z.string().min(0).max(120).optional(),
  city: z.string().min(2).max(80),
});

const GATEWAY_URL =
  process.env.BOSSNYUMBA_API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:3000';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = ApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid pilot application payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    const upstream = await fetch(
      `${GATEWAY_URL.replace(/\/$/, '')}/api/v1/marketing/pilot-application`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      },
    ).catch((err: unknown) => {
      console.error('pilot-apply: upstream unreachable', err);
      return new Response(null, { status: 503 });
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error('pilot-apply: upstream rejected', upstream.status, detail);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UPSTREAM_REJECTED',
            message: 'Pilot application could not be saved upstream.',
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('pilot-apply failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL', message: 'Unexpected error' },
      },
      { status: 500 },
    );
  }
}
