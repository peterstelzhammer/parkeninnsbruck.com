// POST: erzeugt einen signierten Vertragslink aus den Konditionen des Admin-Formulars
import { pruefeKonditionen, erstelleToken } from "../../lib/token.js";
import { summen } from "../../lib/contract.js";
import { json, fehler } from "../../lib/http.js";

export async function onRequestPost({ request, env }) {
  const input = await request.json().catch(() => ({}));
  const { fehler: e, k } = pruefeKonditionen(input);
  if (e.length) return fehler(e);
  try {
    const { token, payload } = await erstelleToken(k, env.TOKEN_SECRET);
    const url = `${new URL(request.url).origin}/vertrag/?t=${token}`;
    return json({ url, id: payload.id, gueltigBis: new Date(payload.exp * 1000).toISOString(), summen: summen(k) });
  } catch (err) {
    return fehler(err.message, 500);
  }
}
