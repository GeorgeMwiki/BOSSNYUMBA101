/**
 * Tests for OCR provider availability detection (KI-014).
 *
 * All functions are pure / side-effect-light. The SDK probe takes an injectable
 * `ModuleImporter`; we pass fakes that resolve (SDK present) or reject (SDK
 * absent) so NO real `@aws-sdk/client-textract` / `@google-cloud/vision` is
 * ever required to install.
 */

import { describe, it, expect } from 'vitest';

import {
  resolveAwsRegion,
  detectTextractCredentials,
  detectVisionCredentials,
  resolveAvailableOcrConfig,
  isSdkInstalled,
  TEXTRACT_SDK_MODULE,
  VISION_SDK_MODULE,
  type AvailabilityEnv,
  type ModuleImporter,
} from '../providers/provider-availability.js';

// ---------------------------------------------------------------------------
// Fake importers
// ---------------------------------------------------------------------------

/** Pretends every dynamic import succeeds (SDK installed). */
const importerAllPresent: ModuleImporter = async () => ({ __sdk: true });

/** Pretends every dynamic import fails (SDK absent). */
const importerNonePresent: ModuleImporter = async () => {
  throw new Error('Cannot find module');
};

/** Resolves only for the listed specifiers; rejects otherwise. */
function importerFor(...present: readonly string[]): ModuleImporter {
  return async (specifier) => {
    if (present.includes(specifier)) return { __sdk: specifier };
    throw new Error(`Cannot find module ${specifier}`);
  };
}

const textractCredsEnv: AvailabilityEnv = {
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
  AWS_SECRET_ACCESS_KEY: 'secretexample',
};

const visionCredsEnv: AvailabilityEnv = {
  GOOGLE_PROJECT_ID: 'bn-docs-prod',
  GOOGLE_APPLICATION_CREDENTIALS: '/var/run/secrets/gcp.json',
};

// ---------------------------------------------------------------------------
// resolveAwsRegion
// ---------------------------------------------------------------------------

describe('resolveAwsRegion', () => {
  it('returns null when neither tenantRegion nor AWS_REGION is present', () => {
    expect(resolveAwsRegion({})).toBeNull();
    expect(resolveAwsRegion({ AWS_REGION: '   ' })).toBeNull();
  });

  it('falls back to env.AWS_REGION when no tenantRegion is given', () => {
    expect(resolveAwsRegion({ AWS_REGION: 'us-east-1' })).toBe('us-east-1');
  });

  it('lets tenantRegion override env.AWS_REGION (data-residency)', () => {
    expect(resolveAwsRegion({ AWS_REGION: 'us-east-1' }, 'af-south-1')).toBe(
      'af-south-1'
    );
  });
});

// ---------------------------------------------------------------------------
// Credential detection
// ---------------------------------------------------------------------------

describe('detectTextractCredentials', () => {
  it('is true with a region + static access keys', () => {
    expect(detectTextractCredentials(textractCredsEnv)).toBe(true);
  });

  it('is true with a region + a shared profile (no static keys)', () => {
    expect(
      detectTextractCredentials({ AWS_REGION: 'eu-west-1', AWS_PROFILE: 'ocr' })
    ).toBe(true);
  });

  it('is false when a region is present but no credential source is', () => {
    expect(detectTextractCredentials({ AWS_REGION: 'eu-west-1' })).toBe(false);
  });

  it('is false when keys are present but no region resolves', () => {
    expect(
      detectTextractCredentials({
        AWS_ACCESS_KEY_ID: 'AKIA',
        AWS_SECRET_ACCESS_KEY: 'sk',
      })
    ).toBe(false);
  });
});

describe('detectVisionCredentials', () => {
  it('is true with a project id + a credentials source', () => {
    expect(detectVisionCredentials(visionCredsEnv)).toBe(true);
  });

  it('is false when the project id is missing', () => {
    expect(
      detectVisionCredentials({
        GOOGLE_APPLICATION_CREDENTIALS: '/var/run/secrets/gcp.json',
      })
    ).toBe(false);
  });

  it('is false when a credentials source is missing', () => {
    expect(detectVisionCredentials({ GOOGLE_PROJECT_ID: 'bn-docs-prod' })).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// isSdkInstalled
// ---------------------------------------------------------------------------

describe('isSdkInstalled', () => {
  it('returns true when the importer resolves the module', async () => {
    expect(await isSdkInstalled(TEXTRACT_SDK_MODULE, importerAllPresent)).toBe(
      true
    );
  });

  it('returns false (never throws) when the importer rejects', async () => {
    expect(await isSdkInstalled(VISION_SDK_MODULE, importerNonePresent)).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// resolveAvailableOcrConfig — selection & fallback
// ---------------------------------------------------------------------------

describe('resolveAvailableOcrConfig', () => {
  it('selects aws_textract when its creds AND SDK are present', async () => {
    const result = await resolveAvailableOcrConfig({
      env: textractCredsEnv,
      importer: importerFor(TEXTRACT_SDK_MODULE),
    });

    expect(result.selected).toBe('aws_textract');
    expect(result.usedFallback).toBe(false);
    expect(result.config).toMatchObject({
      provider: 'aws_textract',
      region: 'eu-west-1',
    });
  });

  it('falls through to google_vision when Textract SDK is absent but Vision is ready', async () => {
    const result = await resolveAvailableOcrConfig({
      // Both sets of creds present; only the Vision SDK installs.
      env: { ...textractCredsEnv, ...visionCredsEnv },
      importer: importerFor(VISION_SDK_MODULE),
    });

    expect(result.selected).toBe('google_vision');
    expect(result.usedFallback).toBe(false);
    expect(result.config).toMatchObject({
      provider: 'google_vision',
      projectId: 'bn-docs-prod',
    });
  });

  it('falls back to the mock stub when creds are present but no SDK installs', async () => {
    const result = await resolveAvailableOcrConfig({
      env: textractCredsEnv,
      importer: importerNonePresent,
    });

    expect(result.selected).toBe('mock');
    expect(result.usedFallback).toBe(true);
    expect(result.config.provider).toBe('mock');
    // The Textract candidate reports creds present but SDK not installed.
    const textract = result.candidates.find(
      (c) => c.provider === 'aws_textract'
    );
    expect(textract?.credentialsPresent).toBe(true);
    expect(textract?.sdkInstalled).toBe(false);
    expect(textract?.available).toBe(false);
  });

  it('falls back to the mock stub when NO credentials are configured (key-less CI)', async () => {
    const result = await resolveAvailableOcrConfig({
      env: {},
      importer: importerAllPresent,
    });

    expect(result.selected).toBe('mock');
    expect(result.usedFallback).toBe(true);
  });
});
