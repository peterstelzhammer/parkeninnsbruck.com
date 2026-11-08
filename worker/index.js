// Worker für parkeninnsbruck.com: liefert die statische Website aus (ASSETS)
// und stellt die API für den Online-Mietvertrag bereit.
import { adminSchutz, basicOk } from "./lib/http.js";
import { sitzungsCookie, notfallGesperrt, notfallFehler } from "./lib/auth.js";
import * as link from "./api/admin/link.js";
import * as vorschau from "./api/admin/vorschau.js";
import * as liste from "./api/admin/liste.js";
import * as datei from "./api/admin/datei.js";
import * as gegenzeichnen from "./api/admin/gegenzeichnen.js";
import * as gegenzeichnungUpload from "./api/admin/gegenzeichnung-upload.js";
import * as authCode from "./api/auth/code.js";
import * as authPruefen from "./api/auth/pruefen.js";
import * as authLogout from "./api/auth/logout.js";
import * as archivieren from "./api/admin/archivieren.js";
import * as offen from "./api/admin/offen.js";
import * as gzLink from "./api/admin/gz-link.js";
import * as gegenzeichnung from "./api/vertrag/gegenzeichnung.js";
import * as info from "./api/vertrag/info.js";
import * as pdf from "./api/vertrag/pdf.js";
import * as signieren from "./api/vertrag/signieren.js";
import * as upload from "./api/vertrag/upload.js";

const ROUTEN = {
  "/api/admin/link": link,
  "/api/admin/vorschau": vorschau,
  "/api/admin/liste": liste,
  "/api/admin/datei": datei,
  "/api/admin/gegenzeichnen": gegenzeichnen,
  "/api/admin/gegenzeichnung-upload": gegenzeichnungUpload,
  "/api/admin/gz-link": gzLink,
  "/api/admin/offen": offen,
  "/api/admin/archivieren": archivieren,
  "/api/auth/code": authCode,
  "/api/auth/pruefen": authPruefen,
  "/api/auth/logout": authLogout,
  "/api/vertrag/gegenzeichnung": gegenzeichnung,
  "/api/vertrag/info": info,
  "/api/vertrag/pdf": pdf,
  "/api/vertrag/signieren": signieren,
  "/api/vertrag/upload": upload,
};

const METHODE = { GET: "onRequestGet", POST: "onRequestPost", DELETE: "onRequestDelete" };

async function api(request, env, ctx, pfad) {
  const modul = ROUTEN[pfad];
  if (!modul) return new Response("Nicht gefunden", { status: 404 });
  const handler = modul[METHODE[request.method]];
  if (!handler) return new Response("Methode nicht erlaubt", { status: 405 });
  try {
    return await handler({ request, env, waitUntil: (p) => ctx.waitUntil(p) });
  } catch (e) {
    console.log("Fehler", pfad, e?.stack || e);
    return new Response(JSON.stringify({ fehler: ["Interner Fehler. Bitte später erneut versuchen."] }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    const pfad = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if (pfad === "/vertrag/admin/passwort") {
      // Notfall-Zugang mit Passwort (Basic Auth), setzt anschließend die normale Sitzung
      if (await notfallGesperrt(env)) {
        return new Response("Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen oder den E-Mail-Code verwenden.", { status: 429, headers: { "cache-control": "no-store" } });
      }
      if (!(await basicOk(request, env))) {
        if (request.headers.get("authorization")) await notfallFehler(env, false); // nur echte Fehlversuche zählen
        return new Response("Anmeldung erforderlich", { status: 401, headers: { "www-authenticate": 'Basic realm="parkeninnsbruck Admin", charset="UTF-8"', "cache-control": "no-store" } });
      }
      await notfallFehler(env, true);
      return new Response(null, { status: 302, headers: { location: "/vertrag/admin/", "set-cookie": await sitzungsCookie(request, env), "cache-control": "no-store" } });
    }
    if (pfad === "/vertrag/admin" || pfad.startsWith("/vertrag/admin/")) {
      return adminSchutz(request, env, () => env.ASSETS.fetch(request));
    }
    if (pfad.startsWith("/api/admin/")) {
      return adminSchutz(request, env, () => api(request, env, ctx, pfad));
    }
    if (pfad.startsWith("/api/")) {
      return api(request, env, ctx, pfad);
    }
    return env.ASSETS.fetch(request);
  },
};
