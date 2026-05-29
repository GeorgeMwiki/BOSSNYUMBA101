/**
 * /.well-known/bossnyumba-capabilities.json + /.well-known/mcp.json
 *
 * Serves the public capability manifest + MCP discovery doc so external
 * agents (Claude Code, Cursor, Windsurf, partner platforms, the
 * bossnyumba CLI / SDK) can fetch one URL and learn the full surface:
 *
 *   transports     — stdio / http / sse
 *   primitives     — sampling, roots, logging, progress, subscriptions,
 *                    streaming, sessions, actions
 *   scopes         — owner:read / owner:write / owner:draft / ...
 *   rate-limits    — per-scope token-bucket defaults
 *   four-eye       — high-stakes action prefixes
 *   tools          — descriptors
 *   resources      — read-only side-data
 *   prompts        — pre-canned templates
 *
 * The manifest object is computed at boot from the @bossnyumba/mcp-server-bossnyumba
 * package — single source of truth.
 *
 * Cache-Control: public, max-age=300 (5 minutes) — clients can poll
 * cheaply. Versioned by the manifest's own `version` field.
 */

import { Hono } from 'hono';
import { buildManifest } from '@bossnyumba/mcp-server-bossnyumba';

export function createWellKnownBossNyumbaRouter(opts: { readonly publicBaseUrl: string }): Hono {
  const router = new Hono();

  const manifest = buildManifest({ publicBaseUrl: opts.publicBaseUrl });

  router.get('/.well-known/bossnyumba-capabilities.json', (c) => {
    c.header('Cache-Control', 'public, max-age=300');
    c.header('Content-Type', 'application/json; charset=utf-8');
    return c.json(manifest);
  });

  // MCP discovery doc — mirrors the `mcp` slice of the capability
  // manifest so a pure-MCP client can fetch only what it needs.
  router.get('/.well-known/mcp.json', (c) => {
    c.header('Cache-Control', 'public, max-age=300');
    c.header('Content-Type', 'application/json; charset=utf-8');
    return c.json({
      version: manifest.version,
      issuer: opts.publicBaseUrl,
      transports: manifest.mcp.transports,
      primitives: manifest.mcp.primitives,
      scopes: manifest.scopes,
      tools: manifest.mcp.tools,
      resources: manifest.mcp.resources,
      prompts: manifest.mcp.prompts,
    });
  });

  return router;
}
