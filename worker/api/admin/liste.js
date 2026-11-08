// GET: eingegangene Verträge aus R2
import { json, fehler } from "../../lib/http.js";

export async function onRequestGet({ env }) {
  if (!env.VERTRAEGE) return fehler("Speicher (R2) ist nicht eingerichtet.", 503);
  const objekte = [];
  let cursor;
  do {
    const l = await env.VERTRAEGE.list({ prefix: "vertraege/", cursor, include: ["customMetadata"] });
    objekte.push(...l.objects);
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
  objekte.sort((a, b) => (a.uploaded < b.uploaded ? 1 : -1));
  const archiv = new Set();
  let c2;
  do {
    const l = await env.VERTRAEGE.list({ prefix: "archiv/", cursor: c2 });
    l.objects.forEach((o) => archiv.add(o.key.split("/")[1]));
    c2 = l.truncated ? l.cursor : undefined;
  } while (c2);
  return json(
    objekte.map((o) => ({ key: o.key, groesse: o.size, hochgeladen: o.uploaded, archiviert: archiv.has(o.key.split("/")[1]), ...(o.customMetadata || {}) }))
  );
}
