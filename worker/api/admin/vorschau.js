// POST: Vorschau-PDF des Vertrags (ohne Mieterdaten) für die Konditionen im Admin-Formular
import { pruefeKonditionen } from "../../lib/token.js";
import { baueVertrag } from "../../lib/contract.js";
import { renderePdf } from "../../lib/pdf.js";
import { loadConfig } from "../../lib/config.js";
import { fehler, pdfAntwort } from "../../lib/http.js";

export async function onRequestPost({ request, env }) {
  const input = await request.json().catch(() => ({}));
  const { fehler: e, k } = pruefeKonditionen(input);
  if (e.length) return fehler(e);
  const kk = { ...k, id: "VORSCHAU" };
  const bytes = await renderePdf(baueVertrag(kk, null, loadConfig(env)), { id: kk.id, titel: "VORSCHAU Mietvertrag Stellplatz" });
  return pdfAntwort(bytes, "Vorschau_Mietvertrag.pdf", true);
}
