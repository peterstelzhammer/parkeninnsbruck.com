// GET: erzeugte Links, zu denen noch nichts eingegangen ist ("wartet auf Mieter"); DELETE ?id=: Eintrag entfernen
import { json, fehler } from "../../lib/http.js";

export async function onRequestGet({ env }) {
  if (!env.VERTRAEGE) return fehler("Speicher (R2) ist nicht eingerichtet.", 503);
  const links = [];
  let cursor;
  do {
    const l = await env.VERTRAEGE.list({ prefix: "links/", cursor, include: ["customMetadata"] });
    links.push(...l.objects);
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
  const jetzt = Date.now();
  const offen = [];
  for (const o of links) {
    const m = o.customMetadata || {};
    if (!m.id) continue;
    const eingang = await env.VERTRAEGE.list({ prefix: `vertraege/${m.id}/`, limit: 1 });
    if (eingang.objects.length) continue;
    offen.push({ ...m, abgelaufen: Number(m.exp) < jetzt });
  }
  offen.sort((a, b) => (a.erstellt < b.erstellt ? 1 : -1));
  return json(offen);
}

export async function onRequestDelete({ request, env }) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!env.VERTRAEGE || !/^[A-Z0-9]{8}$/.test(id)) return fehler("Ungültig.", 400);
  await env.VERTRAEGE.delete(`links/${id}.json`);
  return new Response(null, { status: 204 });
}
