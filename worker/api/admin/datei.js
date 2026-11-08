// GET: Datei herunterladen, DELETE: Datei löschen
import { fehler } from "../../lib/http.js";

function key(request) {
  const k = new URL(request.url).searchParams.get("key") || "";
  return k.startsWith("vertraege/") && !k.includes("..") ? k : null;
}

export async function onRequestGet({ request, env }) {
  const k = key(request);
  if (!k || !env.VERTRAEGE) return fehler("Ungültig.", 400);
  const o = await env.VERTRAEGE.get(k);
  if (!o) return fehler("Nicht gefunden.", 404);
  const name = (o.customMetadata?.art === "online" || o.customMetadata?.art === "gegengezeichnet") && o.customMetadata?.dateiname ? o.customMetadata.dateiname.replace(/[^\w.\-]/g, "_") : k.split("/").pop();
  return new Response(o.body, {
    headers: {
      "content-type": o.httpMetadata?.contentType || "application/octet-stream",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}

export async function onRequestDelete({ request, env }) {
  const k = key(request);
  if (!k || !env.VERTRAEGE) return fehler("Ungültig.", 400);
  await env.VERTRAEGE.delete(k);
  return new Response(null, { status: 204 });
}
