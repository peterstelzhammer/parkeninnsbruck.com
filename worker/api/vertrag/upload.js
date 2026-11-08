// POST multipart {t, datei}: unterschriebenen Vertrag (händisch oder ID Austria) hochladen
import { pruefeToken } from "../../lib/token.js";
import { MAX_UPLOAD_BYTES, STANDORTE } from "../../lib/config.js";
import { json, fehler, jetztWien, pruefeLimit, benachrichtige } from "../../lib/http.js";

const TYPEN = [
  { ext: "pdf", mime: "application/pdf", sig: [0x25, 0x50, 0x44, 0x46] },
  { ext: "jpg", mime: "image/jpeg", sig: [0xff, 0xd8, 0xff] },
  { ext: "png", mime: "image/png", sig: [0x89, 0x50, 0x4e, 0x47] },
];

export async function onRequestPost({ request, env, waitUntil }) {
  const form = await request.formData().catch(() => null);
  if (!form) return fehler("Ungültige Anfrage.");
  const r = await pruefeToken(form.get("t"), env.TOKEN_SECRET);
  if (!r.ok) return fehler(r.grund, 403);
  const k = r.payload;
  const datei = form.get("datei");
  if (!datei || typeof datei === "string") return fehler("Bitte eine Datei auswählen.");
  if (datei.size > MAX_UPLOAD_BYTES) return fehler("Die Datei ist zu groß (max. 15 MB).");
  const bytes = new Uint8Array(await datei.arrayBuffer());
  const typ = TYPEN.find((t) => t.sig.every((b, i) => bytes[i] === b));
  if (!typ) return fehler("Bitte ein PDF, JPG oder PNG hochladen.");
  const limit = await pruefeLimit(env, k.id);
  if (limit) return fehler(limit, 409);

  const art = form.get("art") === "idaustria" ? "idaustria" : "haendisch";
  const name = String(form.get("name") || "").slice(0, 120);
  const zeit = jetztWien();
  const key = `vertraege/${k.id}/${zeit.iso.replace(/[:.]/g, "-")}_${art}.${typ.ext}`;
  await env.VERTRAEGE.put(key, bytes, {
    httpMetadata: { contentType: typ.mime },
    customMetadata: {
      art,
      mieter: name,
      standort: STANDORTE[k.standort].label,
      platz: k.platz,
      dateiname: datei.name?.slice(0, 120) || "",
      ip: request.headers.get("cf-connecting-ip") || "",
    },
  });
  waitUntil(
    benachrichtige(
      env,
      `Unterschriebener Mietvertrag hochgeladen: ${name || k.id} (${STANDORTE[k.standort].label} ${k.platz})`,
      `Für Vertrags-ID ${k.id} (${STANDORTE[k.standort].label}, Stellplatz ${k.platz}) wurde am ${zeit.zeitpunkt} ` +
        `ein unterschriebenes Dokument hochgeladen (${art === "idaustria" ? "ID Austria" : "händisch unterschrieben"}).\n\n` +
        `Herunterladen: ${new URL(request.url).origin}/vertrag/admin/`
    )
  );
  return json({ ok: true });
}
