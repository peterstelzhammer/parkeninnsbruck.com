// Gemeinsame Helfer für die Gegenzeichnung durch den Vermieter.
import { jetztWien } from "./http.js";

export const KEY_OK = (k) => typeof k === "string" && k.startsWith("vertraege/") && !k.includes("..") && k.split("/").length === 3;

// Metadaten des Originals übernehmen und als Gegenzeichnung speichern
export async function speichereGegenzeichnung(env, originalKey, bytes, ext, mime, extra = {}) {
  const orig = await env.VERTRAEGE.head(originalKey);
  if (!orig) return null;
  const id = originalKey.split("/")[1];
  const zeit = jetztWien();
  const key = `vertraege/${id}/${zeit.iso.replace(/[:.]/g, "-")}_gegengezeichnet.${ext}`;
  const m = orig.customMetadata || {};
  await env.VERTRAEGE.put(key, bytes, {
    httpMetadata: { contentType: mime },
    customMetadata: {
      art: "gegengezeichnet",
      mieter: m.mieter || "",
      email: m.email || "",
      standort: m.standort || "",
      platz: m.platz || "",
      dateiname: (m.dateiname || "").replace(/(_online_signiert)?\.pdf$/, "") + `_gegengezeichnet.${ext}`,
      basis: originalKey,
      ...extra,
    },
  });
  return { key, zeit };
}
