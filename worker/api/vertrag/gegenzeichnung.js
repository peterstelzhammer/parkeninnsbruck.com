// GET ?t=…: Mieter lädt die gegengezeichnete Ausfertigung herunter
import { pruefeToken } from "../../lib/token.js";
import { fehler } from "../../lib/http.js";
import { KEY_OK } from "../../lib/gegenzeichnung.js";

export async function onRequestGet({ request, env }) {
  const r = await pruefeToken(new URL(request.url).searchParams.get("t"), env.TOKEN_SECRET, "gz");
  if (!r.ok) return fehler(r.grund, 403);
  const key = r.payload.key;
  if (!env.VERTRAEGE || !KEY_OK(key)) return fehler("Ungültig.", 400);
  const o = await env.VERTRAEGE.get(key);
  if (!o || o.customMetadata?.art !== "gegengezeichnet") return fehler("Nicht gefunden.", 404);
  const ext = key.split(".").pop();
  return new Response(o.body, {
    headers: {
      "content-type": o.httpMetadata?.contentType || "application/octet-stream",
      "content-disposition": `attachment; filename="Mietvertrag_Stellplatz_${(o.customMetadata.platz || "").replace(/[^\w]/g, "")}_gegengezeichnet.${ext}"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
