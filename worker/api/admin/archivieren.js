// POST {id, archiv}: Vertrag ins Archiv legen (true) oder zurückholen (false). Dateien bleiben unverändert.
import { json, fehler } from "../../lib/http.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!env.VERTRAEGE || !/^[A-Z0-9]{8}$/.test(id)) return fehler("Ungültig.");
  if (body.archiv === false) await env.VERTRAEGE.delete(`archiv/${id}`);
  else await env.VERTRAEGE.put(`archiv/${id}`, "", { customMetadata: { id, am: new Date().toISOString() } });
  return json({ ok: true });
}
