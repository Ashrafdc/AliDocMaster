// api/kv.js
// Same-origin key-value backend for Ali DocMaster, backed by Vercel KV.
// Because this runs on the SAME domain as the app (alidocmaster.vercel.app/api/kv),
// there is no CORS to configure — browsers don't apply CORS restrictions to
// same-origin requests at all.
//
// SETUP (one-time):
//  1. In your Vercel project dashboard, go to the "Storage" tab.
//  2. Click "Create Database" -> choose "KV" (Redis, via Upstash).
//  3. Follow the prompts to create it and connect it to this project.
//     Vercel automatically injects the KV_REST_API_URL / KV_REST_API_TOKEN
//     environment variables — no manual env var setup needed.
//  4. Make sure `@vercel/kv` is a dependency (see package.json) and redeploy.

import { kv } from '@vercel/kv';

// Vercel KV (Upstash Redis) auto-parses values that look like JSON when you
// read them back. The app always wants a plain string (it does its own
// JSON.parse/stringify), so this normalizes whatever kv.get() hands back
// into a string.
function toStringValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { action, key, prefix } = req.query;

      if (action === 'get') {
        if (!key) return res.status(400).json({ error: 'Missing key' });
        const raw = await kv.get(key);
        return res.status(200).json({ key, value: toStringValue(raw) });
      }

      if (action === 'list') {
        const pattern = `${prefix || ''}*`;
        const keys = await kv.keys(pattern);
        return res.status(200).json({ keys });
      }

      return res.status(400).json({ error: 'Unknown or missing action' });
    }

    if (req.method === 'POST') {
      // Vercel automatically parses a JSON request body into req.body.
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { action, key, value } = body;

      if (action === 'set') {
        if (!key) return res.status(400).json({ error: 'Missing key' });
        await kv.set(key, value == null ? '' : String(value));
        return res.status(200).json({ ok: true });
      }

      if (action === 'delete') {
        if (!key) return res.status(400).json({ error: 'Missing key' });
        await kv.del(key);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown or missing action' });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
}
