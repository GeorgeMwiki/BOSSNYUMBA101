// Puppeteer HTML→PDF render service. Single shared browser, one
// page per request, A4 print-fidelity. Mirrors the contract the
// PdfFromHtmlRenderer expects when it falls back to the network
// path (production wiring usually uses the in-process factory).
//
// Contract:
//   POST /render
//     body  { html: string, format?: string }
//     200   application/pdf
//     5xx   text/plain reason
//   GET  /health → 200 ok
//
// Refs: https://pptr.dev/api/puppeteer.page.pdf

import express from 'express';
import puppeteer from 'puppeteer-core';

const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/chromium';

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browserPromise;
}

export function startPuppeteer(port) {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.get('/health', async (_req, res) => {
    try {
      const b = await getBrowser();
      const ok = b.connected ?? true;
      res.status(200).json({ ok });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.post('/render', async (req, res) => {
    const { html, format } = req.body ?? {};
    if (typeof html !== 'string' || html.length === 0) {
      return res.status(400).type('text/plain').send('missing html');
    }
    let page;
    try {
      const browser = await getBrowser();
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: format ?? 'A4',
        printBackground: true,
      });
      res.status(200).type('application/pdf').end(pdf);
    } catch (err) {
      res.status(500).type('text/plain').send(String(err));
    } finally {
      if (page) await page.close().catch(() => undefined);
    }
  });

  return app.listen(port, () => {
    console.log(`[puppeteer] listening on :${port}`);
  });
}
