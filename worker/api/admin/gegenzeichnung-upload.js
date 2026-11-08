// POST multipart {key, datei}: gegengezeichnetes Dokument (PDF/JPG/PNG) hochladen
import { MAX_UPLOAD_BYTES } from "../../lib/config.js";
import { json, fehler } from "../../lib/http.js";
import { KEY_OK, speichereGegenzeichnung } from "../../lib/gegenzeichnung.js";

const TYPEN = [
  { ext: "pdf", mime: "application/pdf", sig: [0x25, 0x50, 0x44, 0x46] },
  { ext: "jpg", mime: "image/jpeg", sig: [0xff, 0xd8, 0xff] },
  { ext: "png", mime: "image/png", sig: [0x89, 0x50, 0x4e, 0x47] },
];

export async function onRequestPost({ request, env }) {
  const form = await request.formData().catch(() => null);
  if (!form || !env.VERTRAEGE) return fehler("Ungültige Anfrage.");
  const key = form.get("key");
  if (!KEY_OK(key)) return fehler("Ungültig.");
  const datei = form.get("datei");
  if (!datei || typeof datei === "string") return fehler("Bitte eine Datei auswählen.");
  if (datei.size > MAX_UPLOAD_BYTES) return fehler("Die Datei ist zu groß (max. 15 MB).");
  const bytes = new Uint8Array(await datei.arrayBuffer());
  const typ = TYPEN.find((t) => t.sig.every((b, i) => bytes[i] === b));
  if (!typ) return fehler("Bitte ein PDF, JPG oder PNG hochladen.");
  const r = await speichereGegenzeichnung(env, key, bytes, typ.ext, typ.mime, { art2: "upload" });
  if (!r) return fehler("Vertrag nicht gefunden.", 404);
  const orig = await env.VERTRAEGE.head(key);
  return json({ ok: true, key: r.key, email: orig?.customMetadata?.email || "" });
}
