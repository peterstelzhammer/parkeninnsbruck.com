// Signierte Vertragslinks (HMAC-SHA256). Der Mieter kann die Konditionen im Link nicht verändern.
import { STANDORTE, TOKEN_TAGE } from "./config.js";

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function hmacKey(secret) {
  if (!secret || secret.length < 32) throw new Error("TOKEN_SECRET fehlt oder ist zu kurz (mind. 32 Zeichen).");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export function neueId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(r, (b) => alphabet[b % alphabet.length]).join("");
}

// Prüft und normalisiert die Eingaben aus dem Admin-Formular.
export function pruefeKonditionen(input) {
  const e = [];
  const standort = String(input.standort || "");
  if (!STANDORTE[standort]) e.push("Standort ungültig.");
  const platz = String(input.platz || "").trim();
  if (!platz || platz.length > 20) e.push("Stellplatz-Nr. fehlt.");
  const miete = Math.round(Number(input.miete) * 100) / 100;
  if (!(miete > 0 && miete < 10000)) e.push("Mietzins ungültig.");
  const beginn = String(input.beginn || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(beginn) || isNaN(Date.parse(beginn))) e.push("Mietbeginn ungültig.");
  const gebuehrMieter = input.gebuehr === "mieter";
  if (!["mieter", "vermieter"].includes(input.gebuehr)) e.push("Bitte festlegen, wer die Vertragsgebühr trägt.");
  let kaution = 0;
  if (input.kaution === "ja") {
    kaution = Math.round(Number(input.kautionBetrag) * 100) / 100;
    if (!(kaution > 0 && kaution < 100000)) e.push("Kautionsbetrag ungültig.");
  } else if (input.kaution !== "nein") {
    e.push("Bitte festlegen, ob eine Kaution verlangt wird.");
  }
  let pfand = 0;
  if (input.pfand === "ja") {
    pfand = Math.round(Number(input.pfandBetrag) * 100) / 100;
    if (!(pfand > 0 && pfand < 10000)) e.push("Pfandbetrag ungültig.");
  }
  const email = String(input.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.push("E-Mail-Adresse des Mieters ungültig.");
  return { fehler: e, k: { standort, platz, miete, beginn, gebuehrMieter, kaution, pfand, email } };
}

export async function erstelleToken(konditionen, secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { v: 1, id: neueId(), iat: now, exp: now + TOKEN_TAGE * 86400, ...konditionen };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return { token: `${body}.${b64url(sig)}`, payload };
}

export async function pruefeToken(token, secret) {
  if (typeof token !== "string" || !token.includes(".")) return { ok: false, grund: "Ungültiger Link." };
  const [body, sig] = token.split(".");
  let gueltig = false;
  try {
    const key = await hmacKey(secret);
    gueltig = await crypto.subtle.verify("HMAC", key, unb64url(sig), enc.encode(body));
  } catch {
    gueltig = false;
  }
  if (!gueltig) return { ok: false, grund: "Ungültiger Link." };
  const payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, grund: "Dieser Link ist abgelaufen. Bitte fordere einen neuen an: info@parkeninnsbruck.com" };
  }
  return { ok: true, payload };
}
