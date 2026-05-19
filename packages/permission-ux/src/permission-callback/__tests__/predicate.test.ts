/**
 * predicate evaluation — operators + dot-path traversal.
 */

import { describe, it, expect } from 'vitest';
import { evaluatePredicate } from '../predicate.js';

describe('evaluatePredicate', () => {
  it('returns true for absent / empty predicate', () => {
    expect(evaluatePredicate(null, { args: { x: 1 } })).toBe(true);
    expect(evaluatePredicate(undefined, { args: { x: 1 } })).toBe(true);
    expect(evaluatePredicate({}, { args: { x: 1 } })).toBe(true);
  });

  it('strict-equals scalar values', () => {
    expect(evaluatePredicate({ 'args.x': 1 }, { args: { x: 1 } })).toBe(true);
    expect(evaluatePredicate({ 'args.x': 1 }, { args: { x: 2 } })).toBe(false);
    expect(evaluatePredicate({ 'args.x': 'a' }, { args: { x: 'a' } })).toBe(true);
  });

  it('traverses dot-paths', () => {
    expect(
      evaluatePredicate(
        { 'args.contact.channel': 'sms' },
        { args: { contact: { channel: 'sms' } } },
      ),
    ).toBe(true);
    expect(
      evaluatePredicate(
        { 'args.contact.channel': 'sms' },
        { args: { contact: { channel: 'email' } } },
      ),
    ).toBe(false);
  });

  it('supports eq operator', () => {
    expect(
      evaluatePredicate({ 'args.x': { eq: 5 } }, { args: { x: 5 } }),
    ).toBe(true);
    expect(
      evaluatePredicate({ 'args.x': { eq: 5 } }, { args: { x: 6 } }),
    ).toBe(false);
  });

  it('supports neq operator', () => {
    expect(
      evaluatePredicate({ 'args.x': { neq: 5 } }, { args: { x: 6 } }),
    ).toBe(true);
    expect(
      evaluatePredicate({ 'args.x': { neq: 5 } }, { args: { x: 5 } }),
    ).toBe(false);
  });

  it('supports in operator', () => {
    expect(
      evaluatePredicate(
        { 'args.channel': { in: ['sms', 'wa'] } },
        { args: { channel: 'sms' } },
      ),
    ).toBe(true);
    expect(
      evaluatePredicate(
        { 'args.channel': { in: ['sms', 'wa'] } },
        { args: { channel: 'email' } },
      ),
    ).toBe(false);
  });

  it('supports lte / gte numeric operators', () => {
    expect(
      evaluatePredicate(
        { 'args.amount': { lte: 1000 } },
        { args: { amount: 500 } },
      ),
    ).toBe(true);
    expect(
      evaluatePredicate(
        { 'args.amount': { lte: 1000 } },
        { args: { amount: 1001 } },
      ),
    ).toBe(false);
    expect(
      evaluatePredicate(
        { 'args.amount': { gte: 1000 } },
        { args: { amount: 5000 } },
      ),
    ).toBe(true);
  });

  it('supports prefix operator', () => {
    expect(
      evaluatePredicate(
        { 'args.id': { prefix: 'tn_' } },
        { args: { id: 'tn_abc' } },
      ),
    ).toBe(true);
    expect(
      evaluatePredicate(
        { 'args.id': { prefix: 'tn_' } },
        { args: { id: 'inv_abc' } },
      ),
    ).toBe(false);
  });

  it('combines multiple keys with AND', () => {
    expect(
      evaluatePredicate(
        { 'args.channel': 'sms', 'args.amount': { lte: 100 } },
        { args: { channel: 'sms', amount: 50 } },
      ),
    ).toBe(true);
    expect(
      evaluatePredicate(
        { 'args.channel': 'sms', 'args.amount': { lte: 100 } },
        { args: { channel: 'sms', amount: 5000 } },
      ),
    ).toBe(false);
  });

  it('returns false when path is missing', () => {
    expect(
      evaluatePredicate({ 'args.x': 1 }, { args: { y: 1 } }),
    ).toBe(false);
  });
});
