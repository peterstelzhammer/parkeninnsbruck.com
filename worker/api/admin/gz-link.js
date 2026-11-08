// POST {key}: Download-Link für die gegengezeichnete Ausfertigung (für die E-Mail an den Mieter)
import { erstelleDownloadToken } from "../../lib/token.js";
import { json, fehler } from "../../lib/http.js";
import { KEY_OK } from "../../lib/gegenzeichnung.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!env.VERTRAEGE || !KEY_OK(body.key)) return fehler("Ungültig.");
  const o = await env.VERTRAEGE.head(body.key);
  if (!o || o.customMetadata?.art !== "gegengezeichnet") return fehler("Keine Gegenzeichnung gefunden.", 404);
  const { token, exp } = await erstelleDownloadToken(body.key, env.TOKEN_SECRET);
  return json({ url: `${new URL(request.url).origin}/api/vertrag/gegenzeichnung?t=${token}`, bis: exp * 1000 });
}
