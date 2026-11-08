// Anmeldung im Admin-Bereich: Einmalcode per E-Mail, danach Sitzungs-Cookie.
import { pruefeToken, erstelleSitzung } from "./token.js";

export const SITZUNG_STUNDEN = 24;
export const CODE_MINUTEN = 10;
export const MAX_VERSUCHE = 5;
export const MAX_ANFRAGEN = 5; // Codes pro 15 Minuten
export const MAX_FALSCH_STUNDE = 10; // falsche Codes insgesamt pro Stunde, danach Sperre
const COOKIE = "adm";
const OTP_KEY = "auth/otp.json";
const enc = new TextEncoder();

export async function sitzungOk(request, env) {
  const c = (request.headers.get("cookie") || "").split(/;\s*/).find((x) => x.startsWith(COOKIE + "="));
  if (!c || !env.TOKEN_SECRET) return false;
  try {
    return (await pruefeToken(c.slice(COOKIE.length + 1), env.TOKEN_SECRET, "adm")).ok;
  } catch {
    return false;
  }
}

export async function sitzungsCookie(request, env) {
  const { token } = await erstelleSitzung(env.TOKEN_SECRET, SITZUNG_STUNDEN);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; Max-Age=${SITZUNG_STUNDEN * 3600}; HttpOnly; SameSite=Strict${secure}`;
}

export const cookieLoeschen = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`;

export async function codeHash(code, secret) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`${code}:${secret}`)));
  return Array.from(d, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function neuerCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, "0");
}

export async function ladeOtp(env) {
  const o = await env.VERTRAEGE.get(OTP_KEY);
  if (!o) return { anfragen: [] };
  try {
    return await o.json();
  } catch {
    return { anfragen: [] };
  }
}
export const speichereOtp = (env, otp) => env.VERTRAEGE.put(OTP_KEY, JSON.stringify(otp), { httpMetadata: { contentType: "application/json" } });

// Notfall-Passwort: Fehlversuche zählen (global, nicht pro IP), nach MAX_FEHLER in 15 Minuten gesperrt
const NOTFALL_KEY = "auth/notfall.json";
export const MAX_FEHLER = 5;
export async function notfallGesperrt(env) {
  if (!env.VERTRAEGE) return true;
  const o = await env.VERTRAEGE.get(NOTFALL_KEY);
  const l = o ? await o.json().catch(() => []) : [];
  return l.filter((t) => Date.now() - t < 15 * 60 * 1000).length >= MAX_FEHLER;
}
export async function notfallFehler(env, ok) {
  if (!env.VERTRAEGE) return;
  if (ok) return void (await env.VERTRAEGE.delete(NOTFALL_KEY));
  const o = await env.VERTRAEGE.get(NOTFALL_KEY);
  const l = (o ? await o.json().catch(() => []) : []).filter((t) => Date.now() - t < 15 * 60 * 1000);
  l.push(Date.now());
  await env.VERTRAEGE.put(NOTFALL_KEY, JSON.stringify(l));
}
