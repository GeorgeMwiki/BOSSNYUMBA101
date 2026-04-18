/**
 * OCR provider tests — happy path per provider + factory routing.
 */

import { describe, it, expect } from 'vitest';
import { getOcrProvider } from '../ocr-factory.js';
import { AwsTextractProvider } from '../aws-textract.provider.js';
import { GoogleVisionProvider } from '../google-vision.provider.js';
import { FixtureMockProvider } from '../mock.provider.js';

describe('OCR factory routing', () => {
  it('routes aws_textract config to AwsTextractProvider', () => {
    const provider = getOcrProvider({
      provider: 'aws_textract',
      region: 'eu-west-1',
    });
    expect(provider).toBeInstanceOf(AwsTextractProvider);
    expect(provider.name).toBe('aws_textract');
  });

  it('routes google_vision config to GoogleVisionProvider', () => {
    const provider = getOcrProvider({
      provider: 'google_vision',
      projectId: 'demo-project',
    });
    expect(provider).toBeInstanceOf(GoogleVisionProvider);
    expect(provider.name).toBe('google_vision');
  });

  it('routes mock config to FixtureMockProvider', () => {
    const provider = getOcrProvider({ provider: 'mock' });
    expect(provider).toBeInstanceOf(FixtureMockProvider);
    expect(provider.name).toBe('mock');
  });

  it('validates required fields per provider', () => {
    expect(() =>
      getOcrProvider({ provider: 'aws_textract', region: '' } as never)
    ).toThrow(/region/);
    expect(() =>
      getOcrProvider({ provider: 'google_vision', projectId: '' } as never)
    ).toThrow(/projectId/);
  });
});

describe('FixtureMockProvider happy path', () => {
  it('returns tanzania_nida fixture by default for national_id', async () => {
    const provider = new FixtureMockProvider({ provider: 'mock' });
    const result = await provider.extractText(Buffer.from(''), 'image/jpeg', {
      documentType: 'national_id',
      language: 'en',
    });

    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.pageCount).toBe(1);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.language).toBe('en');
    const nameField = result.fields.find((f) => f.fieldName === 'full_name');
    expect(nameField?.value).toContain('AMINA');
  });

  it('returns driving_licence fixture for drivers_license documentType', async () => {
    const provider = new FixtureMockProvider({ provider: 'mock' });
    const result = await provider.extractText(Buffer.from(''), 'image/jpeg', {
      documentType: 'drivers_license',
    });
    const idNumber = result.fields.find((f) => f.fieldName === 'id_number');
    expect(idNumber?.value).toMatch(/^DL-/);
  });

  it('honours explicit fixtureKey', async () => {
    const provider = new FixtureMockProvider({
      provider: 'mock',
      fixtureKey: 'kenya_id',
    });
    const result = await provider.extractText(Buffer.from(''), 'image/jpeg');
    expect(result.rawText).toContain('REPUBLIC OF KENYA');
  });
});

describe('AwsTextractProvider stub contract', () => {
  it('implements IOCRProvider shape and returns zero-confidence placeholder', async () => {
    const provider = new AwsTextractProvider({
      provider: 'aws_textract',
      region: 'eu-west-1',
    });
    const result = await provider.extractText(Buffer.from([0, 1, 2]), 'image/png', {
      language: 'en',
      documentType: 'national_id',
    });
    expect(result.rawText).toBe('');
    expect(result.fields).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.structuredData).toMatchObject({ stubbed: true });
  });
});

describe('GoogleVisionProvider stub contract', () => {
  it('implements IOCRProvider shape and returns zero-confidence placeholder', async () => {
    const provider = new GoogleVisionProvider({
      provider: 'google_vision',
      projectId: 'demo',
    });
    const result = await provider.extractText(Buffer.from([0]), 'image/jpeg');
    expect(result.fields).toEqual([]);
    expect(result.structuredData).toMatchObject({ stubbed: true });
  });
});
