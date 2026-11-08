// POST: schickt eine Test-Benachrichtigung und meldet, ob es geklappt hat
import { json, sendeMail, jetztWien } from "../../lib/http.js";

export async function onRequestPost({ env }) {
  const r = await sendeMail(env, "Test: Benachrichtigung parkeninnsbruck.com", `Diese Test-Mail wurde am ${jetztWien().zeitpunkt} aus dem Admin-Bereich ausgelöst.\nSo sieht die Benachrichtigung aus, wenn ein Vertrag zum Gegenzeichnen bereit ist.`);
  return json(r, r.ok ? 200 : 502);
}
