// Gemeinsame Helfer für die API-Endpunkte.
import { loadConfig, MAX_EINREICHUNGEN } from "./config.js";

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const fehler = (msg, status = 400) => json({ fehler: Array.isArray(msg) ? msg : [msg] }, status);

export const pdfAntwort = (bytes, dateiname, inline = false) =>
  new Response(bytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${dateiname}"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });

// Basic Auth für den Admin-Bereich (Benutzer: admin, Passwort: Secret ADMIN_PASSWORD)
export async function adminSchutz(request, env, next) {
  const pw = env.ADMIN_PASSWORD;
  if (!pw || pw.length < 12) return new Response("ADMIN_PASSWORD ist nicht (ausreichend lang) gesetzt.", { status: 503 });
  const h = request.headers.get("authorization") || "";
  let ok = false;
  if (h.startsWith("Basic ")) {
    try {
      const [u, ...rest] = atob(h.slice(6)).split(":");
      ok = await gleich(`${u}:${rest.join(":")}`, `admin:${pw}`);
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    return new Response("Anmeldung erforderlich", {
      status: 401,
      headers: { "www-authenticate": 'Basic realm="parkeninnsbruck Admin", charset="UTF-8"', "cache-control": "no-store" },
    });
  }
  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set("cache-control", "no-store");
  out.headers.set("x-robots-tag", "noindex");
  return out;
}

// Vergleich über Hashes, damit die Laufzeit nicht vom Inhalt abhängt
async function gleich(a, b) {
  const e = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", e.encode(a)), crypto.subtle.digest("SHA-256", e.encode(b))]);
  const A = new Uint8Array(x);
  const B = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < A.length; i++) d |= A[i] ^ B[i];
  return d === 0;
}

export function jetztWien() {
  const d = new Date();
  const datum = d.toLocaleDateString("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric" });
  const zeit = d.toLocaleTimeString("de-AT", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit" });
  return { datum, zeitpunkt: `${datum}, ${zeit} Uhr (Wiener Zeit)`, iso: d.toISOString() };
}

export async function anzahlEinreichungen(env, id) {
  const l = await env.VERTRAEGE.list({ prefix: `vertraege/${id}/` });
  return l.objects.length;
}

export async function pruefeLimit(env, id) {
  if (!env.VERTRAEGE) return "Speicher (R2) ist nicht eingerichtet.";
  if ((await anzahlEinreichungen(env, id)) >= MAX_EINREICHUNGEN) {
    return "Für diesen Vertrag wurden bereits mehrere Dokumente eingereicht. Bitte melde dich bei info@parkeninnsbruck.com.";
  }
  return null;
}

// Benachrichtigung per Cloudflare Email (optional: Binding MAIL + "benachrichtigung" in VERTRAG_CONFIG)
export async function benachrichtige(env, betreff, text) {
  const cfg = loadConfig(env);
  if (!env.MAIL || !cfg.benachrichtigung) return false;
  try {
    const { EmailMessage } = await import("cloudflare:email");
    const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
    const body = b64(text).replace(/.{76}/g, "$&\r\n");
    const raw = [
      `From: parkeninnsbruck.com <${cfg.absender}>`,
      `To: ${cfg.benachrichtigung}`,
      `Subject: =?UTF-8?B?${b64(betreff)}?=`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@parkeninnsbruck.com>`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      body,
    ].join("\r\n");
    await env.MAIL.send(new EmailMessage(cfg.absender, cfg.benachrichtigung, raw));
    return true;
  } catch (e) {
    console.log("Benachrichtigung fehlgeschlagen:", e?.message || e);
    return false;
  }
}

export function dateiname(k, m, suffix) {
  const n = (m?.name || "Mieter").normalize("NFKD").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
  return `Mietvertrag_Stellplatz_${k.platz}_${n}_${k.id}${suffix ? "_" + suffix : ""}.pdf`;
}
