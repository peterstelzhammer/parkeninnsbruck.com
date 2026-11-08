// POST {t, mieter}: Vertrag mit Mieterdaten als PDF zum Ausdrucken bzw. Signieren mit ID Austria
import { pruefeToken } from "../../lib/token.js";
import { baueVertrag, pruefeMieter } from "../../lib/contract.js";
import { renderePdf } from "../../lib/pdf.js";
import { loadConfig } from "../../lib/config.js";
import { fehler, pdfAntwort, dateiname } from "../../lib/http.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const r = await pruefeToken(body.t, env.TOKEN_SECRET);
  if (!r.ok) return fehler(r.grund, 403);
  const { fehler: e, m } = pruefeMieter(body.mieter || {});
  if (e.length) return fehler(e);
  const k = r.payload;
  const bytes = await renderePdf(baueVertrag(k, m, loadConfig(env)), { id: k.id });
  return pdfAntwort(bytes, dateiname(k, m));
}
