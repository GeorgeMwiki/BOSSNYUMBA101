-- =============================================================================
-- 0168: Seed the entity_types registry with the 14 built-in types.
--
-- Mirrors `packages/entity-store/src/registry/built-in-types.ts` 1-to-1.
-- If you add a type there, add a row here (and vice versa).
--
-- `schema_zod` holds the `built-in:<name>` handle. The runtime registry
-- resolves these to the Zod schemas embedded in the entity-store package.
-- Runtime-defined types (the MD inventing a new type during chat) will
-- carry an actual Zod expression in this column.
--
-- Idempotent: ON CONFLICT (name) DO UPDATE so re-running this migration
-- against an already-seeded DB is a no-op for unchanged rows and a
-- description / scope refresh for changed ones.
-- =============================================================================

INSERT INTO entity_types (name, schema_zod, jurisdiction_aware, scope, description) VALUES
  (
    'employee',
    'built-in:employee',
    TRUE,
    'tenant',
    'An employee of an owner-customer''s organisation (the owner''s staff: caretaker, property manager, accountant, etc.). Distinct from internal-staff.'
  ),
  (
    'customer-owner',
    'built-in:customer-owner',
    TRUE,
    'platform',
    'An owner-customer of BOSSNYUMBA (the principal who owns properties and chats with the MD).'
  ),
  (
    'property',
    'built-in:property',
    TRUE,
    'tenant',
    'A real-estate asset under management. Backed by the legacy `properties` table during migration; new properties flow through here.'
  ),
  (
    'lease',
    'built-in:lease',
    TRUE,
    'tenant',
    'A tenancy contract between an owner and a tenant-person for a unit. Carries dates, rent, deposit, and renewal terms.'
  ),
  (
    'tenant-person',
    'built-in:tenant-person',
    TRUE,
    'tenant',
    'A natural-person tenant occupying a unit (NOT a BOSSNYUMBA tenant-the-organisation). The "renter" in everyday English.'
  ),
  (
    'vendor',
    'built-in:vendor',
    FALSE,
    'both',
    'A supplier (plumber, electrician, gardening service). Can be platform-scoped (BOSSNYUMBA-vetted marketplace) or tenant-scoped (owner-private).'
  ),
  (
    'lead',
    'built-in:lead',
    FALSE,
    'both',
    'A prospect — someone who has expressed interest. Platform-scoped leads are owner-customer prospects for BOSSNYUMBA; tenant-scoped leads are prospective renters for an owner.'
  ),
  (
    'deal',
    'built-in:deal',
    FALSE,
    'both',
    'A pipeline opportunity (negotiation in progress). Platform-scope = enterprise sales; tenant-scope = unit signing.'
  ),
  (
    'ticket',
    'built-in:ticket',
    FALSE,
    'both',
    'A trouble-ticket / support request. Tenant-scope = maintenance request; platform-scope = customer-success issue against BOSSNYUMBA.'
  ),
  (
    'kra-filing',
    'built-in:kra-filing',
    TRUE,
    'tenant',
    'A Kenya Revenue Authority filing (jurisdiction-aware — TZ uses TRA, UG uses URA; the registry encoding remains generic by the `jurisdiction` attribute).'
  ),
  (
    'campaign',
    'built-in:campaign',
    FALSE,
    'both',
    'A marketing campaign (vacancy promotion, owner outreach, brand). Tenant-scope = owner-private outreach; platform-scope = BOSSNYUMBA growth.'
  ),
  (
    'process-step',
    'built-in:process-step',
    FALSE,
    'both',
    'A single step inside a multi-step workflow (used by the MD''s plan/goal executor). Carries inputs, expected outputs, and status.'
  ),
  (
    'recommendation',
    'built-in:recommendation',
    FALSE,
    'both',
    'An MD-generated recommendation (e.g. "raise unit B14 rent by 6.2%"). Carries evidence, confidence, and an action plan.'
  ),
  (
    'internal-staff',
    'built-in:internal-staff',
    FALSE,
    'platform',
    'BOSSNYUMBA''s OWN employees (engineering, support, sales, ops). Always platform-scope. Only the internal-admin role can read/write.'
  )
ON CONFLICT (name) DO UPDATE
SET
  schema_zod = EXCLUDED.schema_zod,
  jurisdiction_aware = EXCLUDED.jurisdiction_aware,
  scope = EXCLUDED.scope,
  description = EXCLUDED.description;
