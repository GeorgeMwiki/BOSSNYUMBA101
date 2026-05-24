/**
 * SessionStore — interface + in-memory impl + factory for the real
 * drizzle-backed impl (wired by composition root at service start).
 *
 * The orchestrator is pure-functional over the store interface — tests
 * use InMemorySessionStore, production injects the drizzle adapter.
 */

import { randomUUID } from 'node:crypto';
import type { SlotState } from '../slots/slot-schema.js';
import type {
  OnboardingChannel,
  OnboardingSessionEventType,
  OnboardingStatus,
} from './onboarding-sessions-schema.js';

// ---------------------------------------------------------------------------
// Domain shapes.
// ---------------------------------------------------------------------------

export interface OnboardingSession {
  readonly id: string;
  readonly tenantId: string | null;
  readonly startedByUserId: string | null;
  readonly channel: OnboardingChannel;
  readonly locale: string;
  readonly status: OnboardingStatus;
  readonly slots: SlotState;
  readonly transcript: readonly TranscriptEntry[];
  readonly blueprint: TenantBlueprint | null;
  readonly interviewBudget: number;
  readonly turnsUsed: number;
  readonly externalHandle: string | null;
  readonly startedAt: Date;
  readonly lastActivityAt: Date;
  readonly completedAt: Date | null;
  readonly rolledBackAt: Date | null;
}

export interface TranscriptEntry {
  readonly direction: 'in' | 'out';
  readonly kind: 'text' | 'file' | 'voice';
  readonly content: string;
  readonly fileHandle?: string;
  readonly at: Date;
}

export interface CreateSessionInput {
  readonly channel: OnboardingChannel;
  readonly locale?: string;
  readonly externalHandle?: string;
  readonly startedByUserId?: string;
  readonly interviewBudget?: number;
}

export interface SessionEvent {
  readonly id: string;
  readonly sessionId: string;
  readonly type: OnboardingSessionEventType;
  readonly payload: Record<string, unknown>;
  readonly idempotencyKey?: string;
  readonly at: Date;
}

/**
 * The blueprint is the Bootstrapper's input — a structured tenant-shape
 * derived from the slot state. Defined here (not the bootstrapper) so
 * the Confirmer can read/write it without a cyclic import.
 */
export interface TenantBlueprint {
  readonly tenantSlug: string;
  readonly tenantDisplayName: string;
  readonly countryCode: string;
  readonly currency: string;
  readonly primaryLanguage: string;
  readonly properties: readonly BlueprintProperty[];
  readonly team: readonly BlueprintTeamMember[];
  readonly rules: BlueprintRules;
  readonly connectors: BlueprintConnectors;
}

export interface BlueprintProperty {
  readonly slug: string;
  readonly name: string;
  readonly buildingType: string;
  readonly location: string | null;
  readonly units: readonly BlueprintUnit[];
}

export interface BlueprintUnit {
  readonly slug: string;
  readonly label: string;
  readonly unitType: string;
  readonly rentAmount: number;
}

export interface BlueprintTeamMember {
  readonly name: string;
  readonly phone: string;
  readonly role: 'manager' | 'caretaker' | 'accountant' | 'agent';
}

export interface BlueprintRules {
  readonly collectionDayOfMonth: number;
  readonly graceDays: number;
  readonly lateFee: { kind: 'flat' | 'percentage' | 'none'; amount: number };
}

export interface BlueprintConnectors {
  readonly mpesaPaybill?: string;
  readonly mpesaTill?: string;
  readonly whatsappNumber?: string;
}

// ---------------------------------------------------------------------------
// Store interface.
// ---------------------------------------------------------------------------

export interface SessionStore {
  create(input: CreateSessionInput): Promise<OnboardingSession>;
  get(id: string): Promise<OnboardingSession | null>;
  /**
   * Patch is a shallow merge over the existing session. `slots` and
   * `transcript` are unioned, NOT replaced.
   */
  patch(id: string, patch: SessionPatch): Promise<OnboardingSession>;
  appendEvent(sessionId: string, event: AppendEventInput): Promise<SessionEvent>;
  listEvents(sessionId: string): Promise<readonly SessionEvent[]>;
}

export interface SessionPatch {
  readonly tenantId?: string | null;
  readonly status?: OnboardingStatus;
  readonly locale?: string;
  readonly slotsMerge?: SlotState;
  readonly transcriptAppend?: TranscriptEntry;
  readonly blueprint?: TenantBlueprint | null;
  readonly turnsUsedDelta?: number;
  readonly completedAt?: Date;
  readonly rolledBackAt?: Date;
}

export interface AppendEventInput {
  readonly type: OnboardingSessionEventType;
  readonly payload: Record<string, unknown>;
  readonly idempotencyKey?: string;
}

// ---------------------------------------------------------------------------
// In-memory implementation (tests + dev fallback).
// ---------------------------------------------------------------------------

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, OnboardingSession>();
  private readonly events = new Map<string, SessionEvent[]>();
  private readonly idempotencyIndex = new Map<string, SessionEvent>();

  async create(input: CreateSessionInput): Promise<OnboardingSession> {
    const now = new Date();
    const session: OnboardingSession = {
      id: randomUUID(),
      tenantId: null,
      startedByUserId: input.startedByUserId ?? null,
      channel: input.channel,
      locale: input.locale ?? 'en-KE',
      status: 'open',
      slots: {},
      transcript: [],
      blueprint: null,
      interviewBudget: input.interviewBudget ?? 12,
      turnsUsed: 0,
      externalHandle: input.externalHandle ?? null,
      startedAt: now,
      lastActivityAt: now,
      completedAt: null,
      rolledBackAt: null,
    };
    this.sessions.set(session.id, session);
    this.events.set(session.id, []);
    return session;
  }

  async get(id: string): Promise<OnboardingSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async patch(id: string, patch: SessionPatch): Promise<OnboardingSession> {
    const current = this.sessions.get(id);
    if (!current) throw new Error(`session not found: ${id}`);
    const next: OnboardingSession = {
      ...current,
      tenantId: patch.tenantId !== undefined ? patch.tenantId : current.tenantId,
      status: patch.status ?? current.status,
      locale: patch.locale ?? current.locale,
      slots: patch.slotsMerge ? { ...current.slots, ...patch.slotsMerge } : current.slots,
      transcript: patch.transcriptAppend
        ? [...current.transcript, patch.transcriptAppend]
        : current.transcript,
      blueprint: patch.blueprint !== undefined ? patch.blueprint : current.blueprint,
      turnsUsed: current.turnsUsed + (patch.turnsUsedDelta ?? 0),
      lastActivityAt: new Date(),
      completedAt: patch.completedAt ?? current.completedAt,
      rolledBackAt: patch.rolledBackAt ?? current.rolledBackAt,
    };
    this.sessions.set(id, next);
    return next;
  }

  async appendEvent(sessionId: string, input: AppendEventInput): Promise<SessionEvent> {
    if (input.idempotencyKey) {
      const cached = this.idempotencyIndex.get(input.idempotencyKey);
      if (cached) return cached;
    }
    const event: SessionEvent = {
      id: randomUUID(),
      sessionId,
      type: input.type,
      payload: { ...input.payload },
      idempotencyKey: input.idempotencyKey,
      at: new Date(),
    };
    const list = this.events.get(sessionId) ?? [];
    list.push(event);
    this.events.set(sessionId, list);
    if (input.idempotencyKey) this.idempotencyIndex.set(input.idempotencyKey, event);
    return event;
  }

  async listEvents(sessionId: string): Promise<readonly SessionEvent[]> {
    return [...(this.events.get(sessionId) ?? [])];
  }
}
