import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * /api/chat — BossNyumba public marketing chat (hardened dual-mode).
 *
 * Order of preference per request:
 *   1. API gateway (if NEXT_PUBLIC_API_GATEWAY_URL set + reachable within 8s)
 *   2. Direct Anthropic with BossNyumba Mr. Mwikila persona (bilingual EN/SW)
 *
 * The route NEVER throws an unstructured 500. If every path fails we return
 * a JSON `503 ai_unavailable` with a structured `detail` for the widget to
 * surface gracefully.
 *
 * Inline learning blocks (concept_card / ui_block) are appended only on the
 * direct-Anthropic path — the gateway response is treated as opaque so we do
 * not corrupt its envelope.
 */

export const runtime = 'nodejs';

const SYSTEM_PROMPT_EN = `You are Mr. Mwikila, BossNyumba's AI Real-Estate Managing Director.

BossNyumba is the world's first AI Estate-Management Partner that learns your portfolio. You help landlords, tenants, property managers, leasing agents, housing cooperatives, REITs, and institutional landlords (universities, hospitals, embassies, NGOs, religious organizations, government parastatals, corporations with property portfolios) run their estates end-to-end.

Your scope: real estate ONLY (leases, rent, tenants, units, maintenance, listings, inspections, deposits, M-Pesa rent collection, NHC compliance, TRA filings, lease renewals). NEVER discuss mining, mineral licences, royalty, PCCB - those belong to a different product.

Tone: warm, direct, concrete. Calm authority of a senior property manager who has run blocks in Nairobi, Dar es Salaam, Kampala. Lead with a question to understand the visitor before pitching features. ONE capability per turn. Concrete numbers (units, days, shillings) - never vague claims.

Languages: English + Swahili. Match the visitor's language. Keep responses <= 150 words. End with one specific next-step suggestion when relevant.

BossNyumba differentiators to mention when relevant: M-Pesa auto-reconciliation, Swahili-first voice + USSD for station masters, multi-tenant RLS-secured, audit-grade hash-chained ledger, bilingual chat, T1-T5 pricing from individual landlord to multi-country institutional.

NEVER mention "Borjie" or "LitFin" - BossNyumba is its own product.`;

const SYSTEM_PROMPT_SW = `Wewe ni Mr. Mwikila, Mkurugenzi wa AI wa BossNyumba kwa Usimamizi wa Mali Halisia.

BossNyumba ni mfumo wa kwanza duniani wa AI unaojifunza portfolio yako ya nyumba. Unasaidia wenye nyumba, wapangaji, mameneja wa mali, mawakala wa kupanga, vyama vya ushirika wa nyumba, REIT, na taasisi (vyuo vikuu, hospitali, balozi, NGO, mashirika ya kidini, mashirika ya serikali, makampuni yenye portfolio ya mali) kuendesha estate zao kwa ukamilifu.

Wigo wako: mali halisia TU (kodi, mpangaji, vitengo, matengenezo, ukaguzi, amana, ukusanyaji wa kodi kupitia M-Pesa, ufuatiliaji wa NHC, mafaili ya TRA, upyaji wa mikataba). KAMWE usizungumzie uchimbaji, leseni za madini, au mrabaha.

Lugha: Kiswahili na Kiingereza. Linganisha lugha ya mgeni. Weka majibu <= 150 maneno. Maliza na pendekezo moja mahususi linalofuata.

KAMWE usitaje "Borjie" au "LitFin" - BossNyumba ni bidhaa yake yenyewe.`;

const WidgetTurnSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().min(1).max(160),
  language: z.enum(['en', 'sw']).optional(),
  portalId: z.string().max(40).optional(),
  currentRoute: z.string().max(240).optional(),
});

interface ConceptCardBlock {
  readonly type: 'concept_card';
  readonly title: string;
  readonly summary: string;
  readonly keyPoints?: ReadonlyArray<string>;
  readonly citation?: string;
}

interface UiBlock {
  readonly type: 'ui_block';
  readonly kind: string;
  readonly payload: Record<string, unknown>;
}

type InlineChatBlock = ConceptCardBlock | UiBlock;

function emitLearningBlocks(
  userMessage: string,
  language: 'en' | 'sw',
): ReadonlyArray<InlineChatBlock> {
  const msg = userMessage.toLowerCase();

  if (/lease escalation|escalation clause|kifungu cha kupandisha|kifungu cha kuongeza kodi/.test(msg)) {
    const card: ConceptCardBlock =
      language === 'sw'
        ? {
            type: 'concept_card',
            title: 'Vifungu vya Kupandisha Kodi',
            summary:
              'Kifungu cha kupandisha kodi kinaelezea ni kwa kiasi gani na ni mara ngapi kodi inaweza kuongezeka katika kipindi cha mkataba.',
            keyPoints: [
              'Asilimia ya kawaida: 5-10% kwa mwaka',
              'Mara ngapi: mara moja kwa mwaka au baada ya miaka miwili',
              'Hitilafu: kuachia bila ukomo wa juu kunaweza kuvunja mkataba',
              'Jumuisha tarehe kamili na kanuni ya kuhesabu',
            ],
            citation: 'Sheria ya Mali Isiyohamishika ya 2008, Kifungu cha 12',
          }
        : {
            type: 'concept_card',
            title: 'Lease escalation clauses',
            summary:
              'An escalation clause spells out how much and how often rent can rise during the lease term. Tight wording prevents disputes at renewal.',
            keyPoints: [
              'Typical rate: 5-10% per annum',
              'Frequency: annually or biennially',
              'Pitfall: open-ended escalations may be unenforceable',
              'Always include exact dates and the calculation formula',
            ],
            citation: 'Land Act 2008, Section 12 (commercial leases)',
          };
    const sample: UiBlock = {
      type: 'ui_block',
      kind: 'lease_clause_preview',
      payload: {
        clauseLabel: 'Annual escalation',
        clauseText:
          language === 'sw'
            ? 'Kodi ya mwezi itaongezeka kwa asilimia tano (5%) mwanzoni mwa kila mwaka wa mkataba, ikianza mwaka wa pili.'
            : 'Monthly rent shall increase by five percent (5%) on each anniversary of the commencement date, starting from year 2.',
        sampleEscalation:
          language === 'sw'
            ? 'TZS 800,000 -> TZS 840,000 mwaka wa 2 -> TZS 882,000 mwaka wa 3'
            : 'TZS 800,000 -> TZS 840,000 in year 2 -> TZS 882,000 in year 3',
      },
    };
    return [card, sample];
  }

  if (/rent reminder|reminder schedule|kumbusho la kodi|ratiba ya kumbusho/.test(msg)) {
    const card: ConceptCardBlock =
      language === 'sw'
        ? {
            type: 'concept_card',
            title: 'Ratiba ya Kumbusho la Kodi',
            summary:
              'Kumbusho la kawaida hutumwa siku 7, 3, na 1 kabla ya tarehe ya malipo. Hii hupunguza kuchelewa kwa malipo kwa hadi 40%.',
            keyPoints: [
              'Siku 7 kabla: kumbusho la upole',
              'Siku 3 kabla: kumbusho la pili na kiungo cha M-Pesa',
              'Siku 1 kabla: ujumbe wa mwisho',
              'Baada ya tarehe: ada ya kuchelewa inaanza kuhesabiwa',
            ],
            citation: 'Mwongozo wa BossNyumba - Sehemu ya Ukusanyaji wa Kodi',
          }
        : {
            type: 'concept_card',
            title: 'Rent reminder schedule basics',
            summary:
              'A typical reminder ladder fires at 7, 3, and 1 day before the due date. This pattern reduces late payments by up to 40%.',
            keyPoints: [
              '7 days out: gentle reminder',
              '3 days out: second nudge with one-click M-Pesa link',
              '1 day out: final message',
              'After due: late-fee accrual begins',
            ],
            citation: 'BossNyumba operations guide - Rent Collection',
          };
    const sched: UiBlock = {
      type: 'ui_block',
      kind: 'rent_reminder_schedule',
      payload: {
        unitLabel: 'Unit A-12',
        amount: 800_000,
        currency: 'TZS',
        daysBefore: [7, 3, 1],
      },
    };
    return [card, sched];
  }

  return [];
}

async function tryGateway(
  message: string,
  sessionId: string,
  wantsStream: boolean,
): Promise<Response | null> {
  const gatewayBase = (process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '').trim().replace(/\/$/, '');
  if (!gatewayBase) return null;
  try {
    const res = await fetch(`${gatewayBase}/api/v1/public/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: wantsStream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify({ sessionId, message }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

async function callAnthropic(message: string, language: 'en' | 'sw'): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  const system = language === 'sw' ? SYSTEM_PROMPT_SW : SYSTEM_PROMPT_EN;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: message }],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Anthropic ${res.status}: ${detail.slice(0, 240)}`);
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const reply = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('\n')
    .trim();
  return reply || '(no response)';
}

export async function POST(req: Request): Promise<Response> {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'unsupported_media_type' }, { status: 415 });
  }

  let parsed: z.infer<typeof WidgetTurnSchema>;
  try {
    const raw = (await req.json()) as unknown;
    parsed = WidgetTurnSchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 400 },
    );
  }

  const language = parsed.language ?? 'en';
  const wantsStream = (req.headers.get('accept') ?? '').includes('text/event-stream');

  // Path 1 — gateway first (if configured + reachable)
  try {
    const gatewayRes = await tryGateway(parsed.message, parsed.sessionId, wantsStream);
    if (gatewayRes) {
      if (wantsStream && gatewayRes.body) {
        return new Response(gatewayRes.body, {
          status: gatewayRes.status,
          headers: {
            'content-type': gatewayRes.headers.get('content-type') ?? 'text/event-stream',
            'cache-control': 'no-cache',
          },
        });
      }
      const text = await gatewayRes.text();
      let reply = text;
      try {
        const json = JSON.parse(text) as { reply?: string; text?: string };
        reply = json.reply ?? json.text ?? text;
      } catch {
        // body was not JSON — use raw text
      }
      return NextResponse.json(
        { reply, sessionId: parsed.sessionId, source: 'gateway' },
        { status: 200 },
      );
    }
  } catch (err) {
    // Gateway path failed — fall through to direct Anthropic; never throw 500
    console.warn(
      '[/api/chat] gateway path failed, falling back to direct Anthropic:',
      err instanceof Error ? err.message : err,
    );
  }

  // Path 2 — direct Anthropic fallback (bilingual Mr. Mwikila persona)
  try {
    const reply = await callAnthropic(parsed.message, language);
    const blocks = emitLearningBlocks(parsed.message, language);
    return NextResponse.json(
      {
        reply,
        sessionId: parsed.sessionId,
        source: 'direct-anthropic-fallback',
        ...(blocks.length > 0 ? { blocks } : {}),
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: 'ai_unavailable',
        detail: err instanceof Error ? err.message : 'unknown',
        sessionId: parsed.sessionId,
      },
      { status: 503 },
    );
  }
}
