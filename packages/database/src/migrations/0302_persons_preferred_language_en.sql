-- Migration 0302 — flip persons.preferred_language column default to 'en'.
--
-- Per CLAUDE.md hard-rule "English default · bilingual sw/en" (added in
-- commit d57a36df, 2026-05-31). New persons are seeded English by
-- default; Tanzanian users can toggle to `sw` from the settings panel.
-- Toggle behaviour is ABSOLUTE — see the persona LOCALE LOCK directives
-- (apps/marketing/src/app/api/chat/route.ts).
--
-- Existing rows are NOT touched — only the column DEFAULT is altered.
-- Persons that previously sat at `sw` remain at `sw` unless their
-- settings flow updates them.

ALTER TABLE persons
  ALTER COLUMN preferred_language SET DEFAULT 'en';
