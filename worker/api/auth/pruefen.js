// POST {email, code}: prüft den Einmalcode und setzt das Sitzungs-Cookie
import { loadConfig } from "../../lib/config.js";
import { fehler, gleich } from "../../lib/http.js";
import { MAX_VERSUCHE, codeHash, ladeOtp, speichereOtp, sitzungsCookie } from "../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.VERTRAEGE || !env.TOKEN_SECRET) return fehler("Anmeldung ist nicht eingerichtet.", 503);
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").replace(/\D/g, "");
  const admin = String(loadConfig(env).vermieter.email || "").trim().toLowerCase();
  const schlecht = () => fehler("Code falsch oder abgelaufen. Bitte neuen Code anfordern.", 401);

  const otp = await ladeOtp(env);
  if (!otp.hash || !otp.exp || Date.now() > otp.exp || (otp.versuche || 0) >= MAX_VERSUCHE || code.length !== 6) return schlecht();
  otp.versuche = (otp.versuche || 0) + 1;
  const ok = (await gleich(email, admin)) && (await gleich(await codeHash(code, env.TOKEN_SECRET), otp.hash));
  if (!ok) {
    await speichereOtp(env, otp);
    return schlecht();
  }
  delete otp.hash; delete otp.exp; delete otp.versuche; // Code ist verbraucht
  await speichereOtp(env, otp);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "set-cookie": await sitzungsCookie(request, env) },
  });
}
