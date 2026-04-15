/**
 * Brain client — thin hooks that talk to the Brain API.
 *
 * The API endpoints are defined in the api-gateway and proxied to the
 * @bossnyumba/ai-copilot Orchestrator. For Phase 1 we ship the client shape
 * and a local persona catalog stub; the actual API wiring is minimal and
 * defensive — if the backend is not yet available the UI shows a clear
 * "Brain backend unavailable" state instead of silently breaking.
 */

import { useCallback, useEffect, useState } from 'react';

export interface PersonaInfo {
  id: string;
  displayName: string;
  missionStatement: string;
  kind: 'manager' | 'junior' | 'coworker' | 'utility';
}

export interface BrainMessage {
  id: string;
  role: 'user' | 'persona';
  personaId?: string;
  personaLabel?: string;
  text: string;
  advisorConsulted?: boolean;
  visibilityScope?: 'private' | 'team' | 'management' | 'public';
  handoffs?: Array<{ from: string; to: string; objective: string }>;
  toolCalls?: Array<{ tool: string; ok: boolean }>;
  proposedAction?: {
    verb: string;
    object: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reviewRequired: boolean;
  };
  createdAt: string;
}

/**
 * Default persona roster — matches the server-side catalog. If the API
 * exposes `/brain/personae`, we replace this at runtime. This baseline
 * guarantees the UI never renders an empty roster.
 */
export const DEFAULT_PERSONAE: PersonaInfo[] = [
  {
    id: 'estate-manager',
    displayName: 'Estate Manager',
    missionStatement:
      'Admin-facing brain: plan, delegate, synthesize across the portfolio.',
    kind: 'manager',
  },
  {
    id: 'junior.leasing',
    displayName: 'Leasing Junior',
    missionStatement: 'Applicants, viewings, lease drafting, renewals.',
    kind: 'junior',
  },
  {
    id: 'junior.maintenance',
    displayName: 'Maintenance Junior',
    missionStatement: 'Work-order triage, vendor dispatch, emergencies.',
    kind: 'junior',
  },
  {
    id: 'junior.finance',
    displayName: 'Finance Junior',
    missionStatement:
      'Ledger, M-Pesa, arrears, owner statements, KRA, service charge.',
    kind: 'junior',
  },
  {
    id: 'junior.compliance',
    displayName: 'Compliance Junior',
    missionStatement: 'DPA 2019, KRA, landlord-tenant law, cases, evidence.',
    kind: 'junior',
  },
  {
    id: 'junior.communications',
    displayName: 'Communications Junior',
    missionStatement:
      'Notices, replies, campaigns in Swahili/English/Sheng.',
    kind: 'junior',
  },
];

export function usePersonae(): { personae: PersonaInfo[]; loading: boolean } {
  const [personae, setPersonae] = useState<PersonaInfo[]>(DEFAULT_PERSONAE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/brain/personae');
        if (!res.ok) return;
        const data = (await res.json()) as { personae?: PersonaInfo[] };
        if (!cancelled && Array.isArray(data.personae)) {
          setPersonae(data.personae);
        }
      } catch {
        // fall back to defaults silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { personae, loading };
}

interface BrainTurnResponse {
  threadId: string;
  finalPersonaId: string;
  responseText: string;
  handoffs: Array<{ from: string; to: string; objective: string }>;
  toolCalls: Array<{ tool: string; ok: boolean }>;
  advisorConsulted: boolean;
  proposedAction?: {
    verb: string;
    object: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reviewRequired: boolean;
  };
  visibilityScope?: 'private' | 'team' | 'management' | 'public';
  tokensUsed: number;
}

const PERSONA_LABELS: Record<string, string> = {
  'estate-manager': 'Estate Manager',
  'junior.leasing': 'Leasing Junior',
  'junior.maintenance': 'Maintenance Junior',
  'junior.finance': 'Finance Junior',
  'junior.compliance': 'Compliance Junior',
  'junior.communications': 'Communications Junior',
  'migration-wizard': 'Migration Wizard',
};

function labelFor(id: string): string {
  if (id.startsWith('coworker.')) return 'Your Coworker';
  return PERSONA_LABELS[id] ?? id;
}

export function useBrainChat() {
  const [messages, setMessages] = useState<BrainMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const now = new Date().toISOString();
      const userMsg: BrainMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text,
        createdAt: now,
      };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      setError(null);
      try {
        const body = threadId
          ? { threadId, userText: text }
          : { userText: text };
        const res = await fetch('/api/brain/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          let detail = `HTTP ${res.status}`;
          try {
            const j = (await res.json()) as { error?: string };
            if (j.error) detail = j.error;
          } catch {
            // ignore
          }
          throw new Error(detail);
        }
        const data = (await res.json()) as BrainTurnResponse;
        if (!threadId) setThreadId(data.threadId);
        const personaMsg: BrainMessage = {
          id: `p-${Date.now()}`,
          role: 'persona',
          personaId: data.finalPersonaId,
          personaLabel: labelFor(data.finalPersonaId),
          text: data.responseText,
          advisorConsulted: data.advisorConsulted,
          visibilityScope: data.visibilityScope,
          handoffs: data.handoffs,
          toolCalls: data.toolCalls,
          proposedAction: data.proposedAction,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, personaMsg]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Brain backend unavailable'
        );
      } finally {
        setSending(false);
      }
    },
    [threadId]
  );

  return { messages, threadId, sending, error, sendMessage };
}
