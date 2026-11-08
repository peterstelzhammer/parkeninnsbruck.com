// GET ?t=…: Konditionen und Vertragstext (ohne Mieterdaten) für die Mieterseite
import { pruefeToken } from "../../lib/token.js";
import { baueVertrag, summen, euro } from "../../lib/contract.js";
import { loadConfig, STANDORTE } from "../../lib/config.js";
import { json, fehler, anzahlEinreichungen } from "../../lib/http.js";

export async function onRequestGet({ request, env }) {
  const t = new URL(request.url).searchParams.get("t");
  const r = await pruefeToken(t, env.TOKEN_SECRET);
  if (!r.ok) return fehler(r.grund, 403);
  const k = r.payload;
  const s = summen(k);
  const eingereicht = env.VERTRAEGE ? await anzahlEinreichungen(env, k.id) : 0;
  return json({
    id: k.id,
    standort: STANDORTE[k.standort].label,
    adresse: STANDORTE[k.standort].adresse,
    platz: k.platz,
    beginn: k.beginn,
    email: k.email || "",
    eingereicht,
    konditionen: [
      ["Monatsmiete", euro(k.miete)],
      ["Vertragsgebühr", k.gebuehrMieter ? `${euro(s.gebuehr)} (einmalig, trägt der Mieter)` : "übernimmt der Vermieter"],
      ["Kaution", k.kaution > 0 ? euro(k.kaution) : "keine"],
      ...(s.miete.rueckwirkend || s.miete.anteilig ? [["Fällige Miete", `${euro(s.miete.betrag)} (${s.miete.label.replace(/^Miete /, "")})`]] : []),
      ["Jetzt zu überweisen", euro(s.gesamt)],
    ],
    vertrag: baueVertrag(k, null, loadConfig(env)),
  });
}
