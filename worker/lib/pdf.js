// Rendert die Vertragsblöcke als A4-PDF (pdf-lib, Standardschriften).
import { PDFDocument, StandardFonts, rgb } from "./pdf-lib.esm.min.js";

const A4 = [595.28, 841.89];
const M = { l: 62, r: 62, t: 64, b: 70 };
const NAVY = rgb(0.086, 0.196, 0.29);
const GREY = rgb(0.34, 0.41, 0.48);
const BLACK = rgb(0.08, 0.13, 0.17);

export async function renderePdf(blocks, { id, titel = "Mietvertrag Stellplatz" } = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${titel} ${id || ""}`.trim());
  doc.setAuthor("parkeninnsbruck.com");
  doc.setCreator("parkeninnsbruck.com");
  doc.setProducer("parkeninnsbruck.com");
  doc.setLanguage("de-AT");
  const F = await doc.embedFont(StandardFonts.Helvetica);
  const FB = await doc.embedFont(StandardFonts.HelveticaBold);
  const FI = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Zeichen, die WinAnsi nicht kann, ersetzen
  const ok = new Map();
  const clean = (s) =>
    Array.from(String(s ?? ""))
      .map((ch) => {
        if (!ok.has(ch)) {
          try {
            F.encodeText(ch);
            ok.set(ch, true);
          } catch {
            ok.set(ch, false);
          }
        }
        return ok.get(ch) ? ch : "?";
      })
      .join("");

  const W = A4[0] - M.l - M.r;
  let page, y;
  const neueSeite = () => {
    page = doc.addPage(A4);
    y = A4[1] - M.t;
  };
  const platz = (h) => {
    if (y - h < M.b) neueSeite();
  };
  neueSeite();

  // Fließtext mit fett/normal-Läufen umbrechen; gibt Zeilen als [[{text,font}]] zurück
  function umbrechen(runs, size, breite) {
    const woerter = [];
    for (const r of runs) {
      const font = r.b ? FB : r.i ? FI : F;
      const teile = clean(r.text).split(/(\s+)/);
      for (const t of teile) if (t !== "") woerter.push({ text: t, font });
    }
    const zeilen = [];
    let zeile = [];
    let w = 0;
    for (const wort of woerter) {
      const ww = wort.font.widthOfTextAtSize(wort.text, size);
      const istLeer = /^\s+$/.test(wort.text);
      if (istLeer) {
        if (zeile.length) {
          zeile.push(wort);
          w += ww;
        }
        continue;
      }
      if (w + ww > breite && zeile.length) {
        while (zeile.length && /^\s+$/.test(zeile[zeile.length - 1].text)) zeile.pop();
        zeilen.push(zeile);
        zeile = [];
        w = 0;
      }
      // überlange Wörter (z. B. Hash) hart trennen
      if (ww > breite) {
        let rest = wort.text;
        while (rest) {
          let n = rest.length;
          while (n > 1 && wort.font.widthOfTextAtSize(rest.slice(0, n), size) > breite - w) n--;
          zeile.push({ text: rest.slice(0, n), font: wort.font });
          rest = rest.slice(n);
          if (rest) {
            zeilen.push(zeile);
            zeile = [];
            w = 0;
          } else w += wort.font.widthOfTextAtSize(zeile[zeile.length - 1].text, size);
        }
        continue;
      }
      zeile.push(wort);
      w += ww;
    }
    if (zeile.length) zeilen.push(zeile);
    return zeilen;
  }

  function zeichneZeile(zeile, x, yy, size, color = BLACK) {
    let xx = x;
    for (const w of zeile) {
      page.drawText(w.text, { x: xx, y: yy, size, font: w.font, color });
      xx += w.font.widthOfTextAtSize(w.text, size);
    }
  }

  function absatz(runs, { size = 10, lh = 14.2, x = M.l, breite = W, color = BLACK, nach = 6 } = {}) {
    const zeilen = umbrechen(runs, size, breite);
    for (const z of zeilen) {
      platz(lh);
      zeichneZeile(z, x, y - size, size, color);
      y -= lh;
    }
    y -= nach;
  }

  // Spalte mit "Label: Wert"-Zeilen; gibt benötigte Höhe zurück (zeichnet nur bei draw=true)
  function spalte(rows, x, breite, yStart, draw, labelBreite = 0) {
    let yy = yStart;
    for (const [k, v] of rows) {
      if (labelBreite) {
        const zeilen = umbrechen([{ text: v || "" }], 10, breite - labelBreite);
        if (draw) page.drawText(clean(k), { x, y: yy - 10, size: 10, font: F, color: GREY });
        (zeilen.length ? zeilen : [[]]).forEach((z, i) => {
          if (draw) zeichneZeile(z, x + labelBreite, yy - 10 - i * 14, 10);
        });
        yy -= Math.max(1, zeilen.length) * 14 + 2;
      } else {
        const zeilen = umbrechen([{ text: `${k}: ` }, { text: v || "", b: false }], 10, breite);
        zeilen.forEach((z, i) => {
          if (draw) zeichneZeile(z, x, yy - 10 - i * 14, 10);
        });
        yy -= Math.max(1, zeilen.length) * 14 + 4;
      }
    }
    return yStart - yy;
  }

  for (const blk of blocks) {
    if (blk.t === "title") {
      platz(40);
      page.drawText(clean(blk.text), { x: M.l, y: y - 18, size: 18, font: FB, color: NAVY });
      y -= 40;
    } else if (blk.t === "h") {
      platz(14 + 20 + 14 * 2); // Überschrift nicht allein am Seitenende
      y -= 8;
      page.drawText(clean(blk.text), { x: M.l, y: y - 11, size: 11, font: FB, color: NAVY });
      y -= 19;
    } else if (blk.t === "p") {
      absatz(blk.runs);
    } else if (blk.t === "kv") {
      const h = spalte(blk.rows, M.l + 12, W - 12, y, false, 100);
      platz(h + (blk.intro ? 22 : 0));
      if (blk.intro) absatz([{ text: blk.intro }]);
      spalte(blk.rows, M.l + 12, W - 12, y, true, 100);
      y -= h + 6;
    } else if (blk.t === "parties") {
      const gap = 24;
      const cw = (W - gap) / 2;
      const hl = spalte(blk.left.rows, M.l, cw, y - 20, false);
      const hr = spalte(blk.right.rows, M.l + cw + gap, cw, y - 20, false);
      const h = 20 + Math.max(hl, hr) + 8;
      platz(h);
      page.drawText(clean(blk.left.label), { x: M.l, y: y - 11, size: 11, font: FI, color: NAVY });
      page.drawText(clean(blk.right.label), { x: M.l + cw + gap, y: y - 11, size: 11, font: FI, color: NAVY });
      spalte(blk.left.rows, M.l, cw, y - 20, true);
      spalte(blk.right.rows, M.l + cw + gap, cw, y - 20, true);
      y -= h;
      page.drawLine({ start: { x: M.l, y: y + 2 }, end: { x: M.l + W, y: y + 2 }, thickness: 0.6, color: rgb(0.84, 0.89, 0.92) });
      y -= 6;
    } else if (blk.t === "sign") {
      const gap = 30;
      const cw = (W - gap) / 2;
      platz(170);
      y -= 18;
      for (const [i, s] of [blk.left, blk.right].entries()) {
        const x = M.l + i * (cw + gap);
        let yy = y;
        page.drawText(clean(s.label), { x, y: yy - 11, size: 11, font: FI, color: NAVY });
        yy -= 26;
        page.drawText(clean(s.name || ""), { x, y: yy - 10, size: 10, font: FB, color: BLACK });
        yy -= 28;
        page.drawText("Ort, Datum:", { x, y: yy - 10, size: 10, font: F, color: GREY });
        if (s.ortDatum) page.drawText(clean(s.ortDatum), { x: x + 62, y: yy - 10, size: 10, font: F, color: BLACK });
        page.drawLine({ start: { x: x + 60, y: yy - 13 }, end: { x: x + cw, y: yy - 13 }, thickness: 0.6, color: GREY });
        yy -= 62;
        page.drawText("Unterschrift:", { x, y: yy - 10, size: 10, font: F, color: GREY });
        if (s.bild) {
          const bytes = Uint8Array.from(atob(s.bild.split(",")[1]), (c) => c.charCodeAt(0));
          const img = await doc.embedPng(bytes);
          const maxW = cw - 66;
          const maxH = 48;
          const sc = Math.min(maxW / img.width, maxH / img.height);
          page.drawImage(img, { x: x + 64, y: yy - 12, width: img.width * sc, height: img.height * sc });
        }
        page.drawLine({ start: { x: x + 60, y: yy - 13 }, end: { x: x + cw, y: yy - 13 }, thickness: 0.6, color: GREY });
      }
      y -= 130;
    } else if (blk.t === "note") {
      y -= 6;
      absatz([{ text: blk.text }], { size: 8, lh: 11, color: GREY });
    }
  }

  const seiten = doc.getPages();
  seiten.forEach((pg, i) => {
    const t = clean(`${titel}${id ? " · Vertrags-ID " + id : ""} · Seite ${i + 1} von ${seiten.length}`);
    pg.drawText(t, { x: M.l, y: 36, size: 8, font: F, color: GREY });
  });
  return doc.save();
}
