// Carbone HTTP server — minimal compatible surface for the
// `packages/document-studio` CarboneRenderer.
//
// Contract (mirrors carbone-on-prem REST):
//   POST /render/:templateId
//     body  { data: any, convertTo: 'pdf'|'docx'|'xlsx'|'pptx'|... }
//     200   binary file (no JSON envelope)
//     5xx   text/plain error reason
//   GET  /health  → 200 ok
//
// Templates are read from `TEMPLATES_DIR` (default /app/templates) by
// `:templateId` lookup. In dev the host mounts the studio's templates
// dir straight in via docker-compose.
//
// Refs: https://carbone.io/api-reference.html

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import carbone from 'carbone';

const TEMPLATES_DIR = process.env.TEMPLATES_DIR ?? '/app/templates';

export function startCarbone(port) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

  app.post('/render/:templateId', (req, res) => {
    const { templateId } = req.params;
    const { data, convertTo } = req.body ?? {};
    if (!data || typeof data !== 'object') {
      return res.status(400).type('text/plain').send('missing data field');
    }
    const templatePath = resolveTemplate(templateId);
    if (!templatePath) {
      return res
        .status(404)
        .type('text/plain')
        .send(`template not found: ${templateId}`);
    }
    const options = convertTo ? { convertTo } : {};
    carbone.render(templatePath, data, options, (err, result) => {
      if (err) {
        return res.status(500).type('text/plain').send(String(err));
      }
      res.status(200).end(result);
    });
  });

  return app.listen(port, () => {
    console.log(`[carbone] listening on :${port}`);
  });
}

function resolveTemplate(templateId) {
  // Reject path traversal — only basename allowed.
  const safe = path.basename(templateId);
  const exact = path.join(TEMPLATES_DIR, safe);
  if (fs.existsSync(exact)) return exact;
  // Also try common suffixes if the caller passed a bare id.
  for (const ext of ['.docx', '.odt', '.xlsx', '.pptx', '.html']) {
    const candidate = `${exact}${ext}`;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}
