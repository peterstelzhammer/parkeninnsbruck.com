// POST {t, mieter, bild, zustimmung}: Online-Unterschrift (einfache elektronische Signatur)
import { pruefeToken } from "../../lib/token.js";
import { baueVertrag, pruefeMieter, vertragsHash } from "../../lib/contract.js";
import { renderePdf } from "../../lib/pdf.js";
import { loadConfig, STANDORTE } from "../../lib/config.js";
import { fehler, pdfAntwort, dateiname, jetztWien, pruefeLimit, benachrichtige } from "../../lib/http.js";

export async function onRequestPost({ request, env, waitUntil }) {
  const body = await request.json().catch(() => ({}));
  const r = await pruefeToken(body.t, env.TOKEN_SECRET);
  if (!r.ok) return fehler(r.grund, 403);
  const { fehler: e, m } = pruefeMieter(body.mieter || {});
  if (body.zustimmung !== true) e.push("Bitte bestätige, dass du den Vertrag gelesen hast und ihm zustimmst.");
  const bild = String(body.bild || "");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(bild) || bild.length > 400000) e.push("Unterschrift fehlt.");
  if (e.length) return fehler(e);
  const k = r.payload;
  const limit = await pruefeLimit(env, k.id);
  if (limit) return fehler(limit, 409);

  const zeit = jetztWien();
  const hash = await vertragsHash(k, m);
  const bytes = await renderePdf(
    baueVertrag(k, m, loadConfig(env), { datum: zeit.datum, zeitpunkt: zeit.zeitpunkt, hash, bild }),
    { id: k.id }
  );
  const name = dateiname(k, m, "online_signiert");
  const key = `vertraege/${k.id}/${zeit.iso.replace(/[:.]/g, "-")}_online.pdf`;
  await env.VERTRAEGE.put(key, bytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      art: "online",
      mieter: m.name,
      email: m.email,
      standort: STANDORTE[k.standort].label,
      platz: k.platz,
      dateiname: name,
      ip: request.headers.get("cf-connecting-ip") || "",
      agent: (request.headers.get("user-agent") || "").slice(0, 200),
      hash,
    },
  });
  waitUntil(
    benachrichtige(
      env,
      `Mietvertrag online unterschrieben: ${m.name} (${STANDORTE[k.standort].label} ${k.platz})`,
      `${m.name} hat den Mietvertrag für ${STANDORTE[k.standort].label}, Stellplatz ${k.platz}, am ${zeit.zeitpunkt} online unterschrieben.\n\n` +
        `Vertrags-ID: ${k.id}\nE-Mail: ${m.email}\nTelefon: ${m.telefon}\nKennzeichen: ${m.kennzeichen.join(", ")}\n\n` +
        `Herunterladen und gegenzeichnen: ${new URL(request.url).origin}/vertrag/admin/`
    )
  );
  return pdfAntwort(bytes, name);
}
