/**
 * Tokenized carbon-credit verifier.
 *
 * Some VCS credits are bridged on-chain by Toucan Protocol (TCO2),
 * KlimaDAO, Moss (MCO2), or C3. Token holders need to verify that the
 * underlying serial in the registry has *not* been double-counted
 * (e.g. retired off-chain after bridging, or wrapped under two tokens).
 *
 * We model an `EvmReader` port — production wires viem or ethers; tests
 * inject a deterministic mock. The verifier:
 *
 *   1. Reads `tokenURI()` for the supplied token.
 *   2. Parses the metadata into a normalised `TokenMetadata`.
 *   3. Looks up the underlying serial in the Verra registry.
 *   4. Flags double-counting if a prior `seenSerials` set already has it.
 */

import { z } from 'zod';
import type {
  EvmReader,
  TokenMetadata,
  TokenizedCreditRef,
  TokenizedVerificationResult,
} from '../types.js';
import type { VerraClient } from '../verra/client.js';

/** Schema for Toucan/KlimaDAO/Moss metadata — only fields we need. */
const TokenUriSchema = z
  .object({
    serialNumber: z.string().min(1).optional(),
    projectId: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
    vintage: z.number().int().min(1990).max(2100).optional(),
    issuer: z.enum(['Toucan', 'KlimaDAO', 'Moss', 'C3', 'Unknown']).optional(),
    /** Toucan vintage-token names embed the serial. */
    projectVintageTokenId: z.string().optional(),
    /** Some bridges nest the registry fields. */
    underlying: z
      .object({
        serialNumber: z.string().optional(),
        projectId: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
        vintage: z.number().int().optional(),
      })
      .optional(),
  })
  .passthrough();

export interface TokenizedVerifier {
  verifyTokenizedCredit(ref: TokenizedCreditRef): Promise<TokenizedVerificationResult>;
}

export interface CreateTokenizedVerifierOptions {
  readonly evm: EvmReader;
  readonly verra: VerraClient;
  /**
   * Optional cross-call memory of serials seen during this verifier's
   * lifetime — surfaces double-counting when the *same* serial is
   * exposed under two distinct on-chain tokens. Tests can pre-seed.
   */
  readonly seenSerials?: Set<string>;
}

export function createTokenizedCreditVerifier(
  opts: CreateTokenizedVerifierOptions,
): TokenizedVerifier {
  const seen = opts.seenSerials ?? new Set<string>();
  return {
    async verifyTokenizedCredit(ref) {
      const narrative: string[] = [];
      narrative.push(`Reading tokenURI for ${ref.chain}:${ref.contractAddress}/${ref.tokenId}`);
      const raw = await opts.evm.tokenURI(ref);
      const parsed = TokenUriSchema.safeParse(raw);
      if (!parsed.success) {
        narrative.push(`tokenURI parse failed: ${parsed.error.issues.length} issues`);
        return {
          ref,
          metadata: {
            underlyingSerial: '',
            projectId: '',
            vintage: 0,
            issuer: 'Unknown',
          },
          registryMatch: null,
          underlyingRetired: false,
          doubleCountFlag: false,
          narrative,
        };
      }
      const meta = normaliseMetadata(parsed.data);
      narrative.push(
        `Underlying serial=${meta.underlyingSerial} project=${meta.projectId} vintage=${meta.vintage} issuer=${meta.issuer}`,
      );
      const doubleCountFlag = seen.has(meta.underlyingSerial) && meta.underlyingSerial !== '';
      if (meta.underlyingSerial) {
        seen.add(meta.underlyingSerial);
      }
      if (doubleCountFlag) {
        narrative.push(`DOUBLE-COUNT: serial ${meta.underlyingSerial} seen under more than one token`);
      }
      let registryMatch = null;
      let underlyingRetired = false;
      if (meta.projectId) {
        try {
          registryMatch = await opts.verra.getProject(meta.projectId);
          narrative.push(`Registry match: ${registryMatch.name} (${registryMatch.status})`);
        } catch (err) {
          narrative.push(`Registry lookup failed: ${(err as Error).message}`);
        }
      }
      if (meta.underlyingSerial) {
        try {
          const result = await opts.verra.verifyCredit(meta.underlyingSerial);
          if (result === null) {
            narrative.push(`Registry has no record of serial ${meta.underlyingSerial} — possible orphan bridge`);
          } else {
            underlyingRetired = result.retired;
            narrative.push(`Registry serial retired? ${result.retired}`);
          }
        } catch (err) {
          narrative.push(`Serial lookup failed: ${(err as Error).message}`);
        }
      }
      return {
        ref,
        metadata: meta,
        registryMatch,
        underlyingRetired,
        doubleCountFlag,
        narrative,
      };
    },
  };
}

function normaliseMetadata(parsed: z.infer<typeof TokenUriSchema>): TokenMetadata {
  const serial = parsed.serialNumber
    ?? parsed.underlying?.serialNumber
    ?? extractSerialFromVintageTokenId(parsed.projectVintageTokenId)
    ?? '';
  const projectId = parsed.projectId
    ?? parsed.underlying?.projectId
    ?? '';
  const vintage = parsed.vintage
    ?? parsed.underlying?.vintage
    ?? 0;
  return {
    underlyingSerial: serial,
    projectId,
    vintage,
    issuer: parsed.issuer ?? 'Unknown',
  };
}

/** Toucan TCO2-VCS-1234-2024 style identifiers — extract the serial-ish slug. */
function extractSerialFromVintageTokenId(s: string | undefined): string | undefined {
  if (!s) return undefined;
  // Toucan exposes a derived serial in vintage-token names; we keep
  // the slug verbatim as a stable lookup key.
  return s;
}
