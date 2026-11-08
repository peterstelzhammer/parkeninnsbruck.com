// POST {key, bild}: Vermieter-Unterschrift (PNG vom Touchfeld) in das online unterschriebene PDF setzen
import { PDFDocument, StandardFonts, rgb } from "../../lib/pdf-lib.esm.min.js";
import { loadConfig } from "../../lib/config.js";
import { json, fehler, jetztWien } from "../../lib/http.js";
import { KEY_OK, speichereGegenzeichnung } from "../../lib/gegenzeichnung.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!env.VERTRAEGE || !KEY_OK(body.key)) return fehler("Ungültig.");
  const bild = String(body.bild || "");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(bild) || bild.length > 400000) return fehler("Unterschrift fehlt.");
  const o = await env.VERTRAEGE.get(body.key);
  if (!o) return fehler("Vertrag nicht gefunden.", 404);
  if (o.customMetadata?.art !== "online") {
    return fehler("Online gegenzeichnen geht nur bei online unterschriebenen Verträgen. Bitte ein gegengezeichnetes Dokument hochladen.");
  }
  const doc = await PDFDocument.load(await o.arrayBuffer());
  const mark = /vsig:([\d.,]+)/.exec(doc.getKeywords() || "");
  if (!mark) return fehler("Dieses PDF ist älter und hat keine Markierung für die Vermieter-Unterschrift. Bitte ein gegengezeichnetes Dokument hochladen.");
  const [pi, x, ortY, sigY, w] = mark[1].split(",").map(Number);
  const seite = doc.getPages()[pi];
  if (!seite) return fehler("Unterschriftsfeld nicht gefunden.");

  const F = await doc.embedFont(StandardFonts.Helvetica);
  const zeit = jetztWien();
  const ort = (loadConfig(env).vermieter.plzOrt || "").replace(/^\d+\s*/, "").trim() || "Innsbruck";
  seite.drawText(`${ort}, ${zeit.datum}`, { x, y: ortY, size: 10, font: F, color: rgb(0, 0, 0) });
  const png = await doc.embedPng(Uint8Array.from(atob(bild.split(",")[1]), (c) => c.charCodeAt(0)));
  const sc = Math.min(w / png.width, 34 / png.height);
  seite.drawImage(png, { x, y: sigY, width: png.width * sc, height: png.height * sc });
  seite.drawText(`Online gegengezeichnet, ${zeit.datum} ${zeit.zeitpunkt.split(", ")[1].replace(" Uhr (Wiener Zeit)", "")}`, {
    x: x + 52,
    y: sigY - 11,
    size: 6.5,
    font: F,
    color: rgb(0.45, 0.45, 0.45),
  });
  const bytes = await doc.save();
  const r = await speichereGegenzeichnung(env, body.key, bytes, "pdf", "application/pdf", {
    ip: request.headers.get("cf-connecting-ip") || "",
    art2: "online",
  });
  return json({ ok: true, key: r.key, email: o.customMetadata?.email || "" });
}
