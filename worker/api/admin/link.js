// POST: erzeugt einen signierten Vertragslink aus den Konditionen des Admin-Formulars
import { pruefeKonditionen, erstelleToken } from "../../lib/token.js";
import { summen } from "../../lib/contract.js";
import { json, fehler } from "../../lib/http.js";
import { STANDORTE } from "../../lib/config.js";

export async function onRequestPost({ request, env }) {
  const input = await request.json().catch(() => ({}));
  const { fehler: e, k } = pruefeKonditionen(input);
  if (e.length) return fehler(e);
  try {
    const { token, payload } = await erstelleToken(k, env.TOKEN_SECRET);
    const url = `${new URL(request.url).origin}/vertrag/?t=${token}`;
    if (env.VERTRAEGE) {
      // Merkzettel für die Liste "wartet auf Mieter": Konditionen + Link (für Vorschau/Kopieren), keine Mieterdaten
      await env.VERTRAEGE.put(`links/${payload.id}.json`, JSON.stringify({ k, url }), {
        customMetadata: {
          id: payload.id,
          vorschau: "1",
          vorname: String(input.vorname || "").trim().slice(0, 60),
          email: k.email || "",
          standort: STANDORTE[k.standort].label,
          platz: k.platz,
          beginn: k.beginn,
          erstellt: new Date().toISOString(),
          exp: String(payload.exp * 1000),
        },
      }).catch(() => {});
    }
    return json({ url, id: payload.id, gueltigBis: new Date(payload.exp * 1000).toISOString(), summen: summen(k) });
  } catch (err) {
    return fehler(err.message, 500);
  }
}
