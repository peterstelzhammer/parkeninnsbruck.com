// POST {email}: sendet einen Einmalcode an die Admin-Adresse
import { loadConfig } from "../../lib/config.js";
import { json, fehler, sendeMail, gleich } from "../../lib/http.js";
import { CODE_MINUTEN, MAX_ANFRAGEN, codeHash, neuerCode, ladeOtp, speichereOtp } from "../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.VERTRAEGE || !env.TOKEN_SECRET) return fehler("Anmeldung ist nicht eingerichtet.", 503);
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const cfg = loadConfig(env);
  const admin = String(cfg.vermieter.email || "").trim().toLowerCase();
  if (!admin.includes("@") || !cfg.benachrichtigung) return fehler("Anmeldung ist nicht eingerichtet (VERTRAG_CONFIG: vermieter.email und benachrichtigung).", 503);

  const jetzt = Date.now();
  const otp = await ladeOtp(env);
  otp.anfragen = (otp.anfragen || []).filter((t) => jetzt - t < 15 * 60 * 1000);
  if (otp.anfragen.length >= MAX_ANFRAGEN) return fehler("Zu viele Anfragen. Bitte in 15 Minuten erneut versuchen.", 429);
  otp.anfragen.push(jetzt);

  const antwort = json({ ok: true });
  if (!(await gleich(email, admin))) {
    await speichereOtp(env, otp);
    return antwort; // keine Auskunft, ob die Adresse stimmt
  }
  const code = neuerCode();
  otp.hash = await codeHash(code, env.TOKEN_SECRET);
  otp.exp = jetzt + CODE_MINUTEN * 60 * 1000;
  otp.versuche = 0;
  await speichereOtp(env, otp);
  const r = await sendeMail(
    env,
    "Dein Admin-Code für parkeninnsbruck.com",
    `Dein Code für die Anmeldung im Admin-Bereich: ${code}\n\nDer Code ist ${CODE_MINUTEN} Minuten gültig und kann einmal verwendet werden. Wenn du dich nicht angemeldet hast, ignoriere diese Mail.`
  );
  if (!r.ok) return fehler(`Die E-Mail mit dem Code konnte nicht gesendet werden: ${r.grund}`, 502);
  return antwort;
}
