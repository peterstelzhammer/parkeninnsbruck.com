// GET ?id=XXXXXXXX: Vorschau-PDF zu einem erzeugten Link; &link=1 liefert den Link-URL als JSON
import { baueVertrag } from "../../lib/contract.js";
import { renderePdf } from "../../lib/pdf.js";
import { loadConfig } from "../../lib/config.js";
import { json, fehler, pdfAntwort } from "../../lib/http.js";

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const id = u.searchParams.get("id") || "";
  if (!env.VERTRAEGE || !/^[A-Z0-9]{8}$/.test(id)) return fehler("Ungültig.", 400);
  const o = await env.VERTRAEGE.get(`links/${id}.json`);
  const d = o ? await o.json().catch(() => null) : null;
  if (!d?.k) return fehler("Für diesen Link ist keine Vorschau gespeichert (älterer Link).", 404);
  if (u.searchParams.get("link")) return json({ url: d.url });
  const kk = { ...d.k, id };
  const bytes = await renderePdf(baueVertrag(kk, null, loadConfig(env)), { id, titel: "VORSCHAU Mietvertrag Stellplatz" });
  return pdfAntwort(bytes, "Vorschau_Mietvertrag.pdf", true);
}
