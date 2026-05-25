/**
 * Discovery script — the canonical 12-turn template MD uses as a
 * fallback / prior. Derived from research §11 ("MD discovery script —
 * 30+ slot-fill questions in conversational form").
 *
 * The ranker is the source of truth at runtime — but the script is:
 *   1. A baseline regression target (turn-N should ask about slot X).
 *   2. A "warm start" when state is empty (turn 1 = greeting + locale).
 *   3. Documentation for product / QA.
 *
 * Each turn names ONE primary slot plus optional "batch" slots that
 * the Intake agent groups into a single conversational message
 * ("Per building — units? rent? caretaker?").
 */

import type { SlotKey } from './slot-schema.js';

export interface ScriptTurn {
  readonly turn: number;
  readonly purpose: string;
  readonly primarySlot: SlotKey;
  readonly batchSlots?: readonly SlotKey[];
}

export const DISCOVERY_SCRIPT: readonly ScriptTurn[] = [
  {
    turn: 1,
    purpose: 'Greeting + AUP disclosure + language detect.',
    primarySlot: 'preferred_language',
    batchSlots: ['country_code'],
  },
  {
    turn: 2,
    purpose: 'Identity — name + phone gate every other write.',
    primarySlot: 'owner_full_name',
    batchSlots: ['owner_phone', 'company_name'],
  },
  {
    turn: 3,
    purpose: 'Portfolio breadth.',
    primarySlot: 'portfolio_property_count',
    batchSlots: ['portfolio_unit_count_total'],
  },
  {
    turn: 4,
    purpose: 'Portfolio names + locations (unlocks per-property follow-ups).',
    primarySlot: 'portfolio_property_names',
    batchSlots: ['portfolio_locations', 'portfolio_building_types'],
  },
  {
    turn: 5,
    purpose: 'Unit shape (drives bootstrap unit-creation count).',
    primarySlot: 'portfolio_unit_types',
    batchSlots: ['portfolio_rent_range', 'currency'],
  },
  {
    turn: 6,
    purpose: 'Collection cadence + late-fee policy (drives reminder cron).',
    primarySlot: 'collection_day_of_month',
    batchSlots: ['grace_period_days', 'late_fee_policy'],
  },
  {
    turn: 7,
    purpose: 'Money tools (drives M-Pesa wiring).',
    primarySlot: 'mpesa_paybill',
    batchSlots: ['mpesa_till', 'bank_account'],
  },
  {
    turn: 8,
    purpose: 'Team (drives invitations).',
    primarySlot: 'team_managers',
    batchSlots: ['team_vendors'],
  },
  {
    turn: 9,
    purpose: 'Maintenance posture (drives default WO SLA).',
    primarySlot: 'maintenance_sla_hours',
    batchSlots: ['maintenance_who_pays', 'deposit_policy'],
  },
  {
    turn: 10,
    purpose: 'Pain points (free-text — pure product feedback).',
    primarySlot: 'pain_points_top',
    batchSlots: ['wishes'],
  },
  {
    turn: 11,
    purpose: 'KYC verification gate.',
    primarySlot: 'kyc_id_uploaded',
    batchSlots: ['owner_kra_pin'],
  },
  {
    turn: 12,
    purpose: 'Confirm + commit (no new slots — Verifier surfaces blueprint).',
    primarySlot: 'preferred_language', // sentinel — handled by Confirmer, not ranker.
  },
] as const;

export const SCRIPT_TURN_COUNT = DISCOVERY_SCRIPT.length;

export function scriptForTurn(turn: number): ScriptTurn | null {
  return DISCOVERY_SCRIPT.find((t) => t.turn === turn) ?? null;
}
