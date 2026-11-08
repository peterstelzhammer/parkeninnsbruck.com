// Rendert die Vertragsblöcke als A4-PDF (pdf-lib, Standardschriften).
// Layout: Briefkopf mit P-Logo, nummerierte Paragraphen, Parteien- und Unterschriftskästen.
import { PDFDocument, StandardFonts, rgb } from "./pdf-lib.esm.min.js";

const A4 = [595.28, 841.89];
const M = { l: 62, r: 62, t: 104, b: 72 };
const NAVY = rgb(0.086, 0.196, 0.29);
const GREY = rgb(0.34, 0.41, 0.48);
const BLACK = rgb(0.08, 0.13, 0.17);
const ICE = rgb(0.933, 0.957, 0.973);
const LINE = rgb(0.84, 0.886, 0.918);

// Rechteck mit abgerundeten Ecken als SVG-Pfad (Ursprung oben links, y nach unten)
const rr = (w, h, r) =>
  `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;

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
  let page, y, vsig = null;

  function box(x, top, w, h, { fill = null, border = null, r = 8 } = {}) {
    page.drawSvgPath(rr(w, h, r), {
      x,
      y: top,
      color: fill || undefined,
      borderColor: border || undefined,
      borderWidth: border ? 0.8 : 0,
    });
  }

  function kopf() {
    const top = A4[1] - 46;
    box(M.l, top + 6, 24, 24, { fill: NAVY, r: 6 });
    const pw = FB.widthOfTextAtSize("P", 15);
    page.drawText("P", { x: M.l + 12 - pw / 2, y: top - 13, size: 15, font: FB, color: rgb(1, 1, 1) });
    page.drawText("parkeninnsbruck.com", { x: M.l + 32, y: top - 6, size: 12, font: FB, color: NAVY });
    page.drawText("Stellplatzvermietung in Innsbruck", { x: M.l + 32, y: top - 17, size: 8, font: F, color: GREY });
    const rechts = "Mietvertrag Kfz-Stellplatz";
    page.drawText(rechts, { x: A4[0] - M.r - F.widthOfTextAtSize(rechts, 8), y: top - 6, size: 8, font: F, color: GREY });
    page.drawLine({ start: { x: M.l, y: top - 28 }, end: { x: A4[0] - M.r, y: top - 28 }, thickness: 1.2, color: NAVY });
  }

  const neueSeite = () => {
    page = doc.addPage(A4);
    kopf();
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
      for (const t of clean(r.text).split(/(\s+)/)) if (t !== "") woerter.push({ text: t, font });
    }
    const zeilen = [];
    let zeile = [];
    let w = 0;
    for (const wort of woerter) {
      const ww = wort.font.widthOfTextAtSize(wort.text, size);
      if (/^\s+$/.test(wort.text)) {
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
      if (ww > breite) {
        // überlange Wörter (z. B. Prüfsumme) hart trennen
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

  function absatz(runs, { size = 10, lh = 14.4, x = M.l, breite = W, color = BLACK, nach = 6 } = {}) {
    for (const z of umbrechen(runs, size, breite)) {
      platz(lh);
      zeichneZeile(z, x, y - size, size, color);
      y -= lh;
    }
    y -= nach;
  }

  // Zeilen "Label  Wert" mit fester Labelbreite; gibt Höhe zurück, zeichnet nur bei draw=true
  function felder(rows, x, breite, yStart, draw, labelBreite, size = 9.5, lh = 13.5) {
    let yy = yStart;
    for (const [k, v] of rows) {
      const zeilen = umbrechen([{ text: v || "" }], size, breite - labelBreite);
      if (draw) page.drawText(clean(k), { x, y: yy - size, size: size - 1, font: F, color: GREY });
      (zeilen.length ? zeilen : [[]]).forEach((z, i) => {
        if (draw) zeichneZeile(z, x + labelBreite, yy - size - i * lh, size);
      });
      yy -= Math.max(1, zeilen.length) * lh + 1.5;
    }
    return yStart - yy;
  }

  for (const blk of blocks) {
    if (blk.t === "title") {
      platz(44);
      page.drawText(clean(blk.text), { x: M.l, y: y - 20, size: 20, font: FB, color: NAVY });
      y -= 40;
    } else if (blk.t === "h") {
      platz(14 + 22 + 14.4 * 2); // Überschrift nicht allein am Seitenende
      y -= 9;
      const [nr, ...rest] = clean(blk.text).split(" ");
      const istPara = nr === "§";
      if (istPara) {
        const num = `§ ${rest.shift()}`;
        page.drawText(num, { x: M.l, y: y - 11.5, size: 11.5, font: FB, color: NAVY });
        page.drawText(rest.join(" "), { x: M.l + 30, y: y - 11.5, size: 11.5, font: FB, color: NAVY });
      } else {
        page.drawText(clean(blk.text), { x: M.l, y: y - 11.5, size: 11.5, font: FB, color: NAVY });
      }
      y -= 21;
    } else if (blk.t === "p") {
      absatz(blk.runs);
    } else if (blk.t === "kv") {
      const pad = 12;
      const hInhalt = felder(blk.rows, M.l + pad, W - 2 * pad, 0, false, 92);
      const intro = blk.intro ? 22 : 0;
      platz(intro + hInhalt + 2 * pad - 4);
      if (blk.intro) absatz([{ text: blk.intro }], { nach: 4 });
      box(M.l, y, W, hInhalt + 2 * pad - 6, { border: LINE });
      felder(blk.rows, M.l + pad, W - 2 * pad, y - pad + 2, true, 92);
      y -= hInhalt + 2 * pad + 2;
    } else if (blk.t === "pay") {
      const lh = 14;
      const breite = W - 12;
      const labelBreite = breite - 110;
      const zeilen = blk.rows.map(([k]) => umbrechen([{ text: k }], 10, labelBreite));
      const h = 36 + zeilen.reduce((s, z) => s + z.length * lh + 3, 0) + lh + 10;
      platz(h);
      absatz([{ text: blk.intro }], { nach: 4 });
      blk.rows.forEach(([, v], i) => {
        zeilen[i].forEach((z, j) => zeichneZeile(z, M.l + 12, y - 10 - j * lh, 10));
        page.drawText(clean(v), { x: M.l + breite - F.widthOfTextAtSize(clean(v), 10), y: y - 10, size: 10, font: F, color: BLACK });
        y -= zeilen[i].length * lh + 3;
      });
      box(M.l, y - 1, breite + 12, lh + 4, { fill: ICE, r: 5 });
      const [tk, tv] = blk.total;
      page.drawText(clean(tk), { x: M.l + 12, y: y - 12, size: 10.5, font: FB, color: NAVY });
      page.drawText(clean(tv), { x: M.l + breite - FB.widthOfTextAtSize(clean(tv), 10.5), y: y - 12, size: 10.5, font: FB, color: NAVY });
      y -= lh + 16;
    } else if (blk.t === "parties") {
      const gap = 14;
      const pad = 12;
      const cw = (W - gap) / 2;
      const inner = cw - 2 * pad;
      const hl = felder(blk.left.rows, 0, inner, 0, false, 54);
      const hr = felder(blk.right.rows, 0, inner, 0, false, 54);
      const h = pad + 18 + Math.max(hl, hr) + pad - 2;
      platz(h + 12);
      for (const [i, s] of [blk.left, blk.right].entries()) {
        const x = M.l + i * (cw + gap);
        box(x, y, cw, h, { fill: ICE });
        page.drawText(clean(s.label).toUpperCase(), { x: x + pad, y: y - pad - 8, size: 8.5, font: FB, color: NAVY });
        felder(s.rows, x + pad, inner, y - pad - 18, true, 54);
      }
      y -= h + 12;
    } else if (blk.t === "sign") {
      const gap = 14;
      const pad = 14;
      const cw = (W - gap) / 2;
      const h = 150;
      platz(h + 20);
      y -= 14;
      for (const [i, s] of [blk.left, blk.right].entries()) {
        const x = M.l + i * (cw + gap);
        box(x, y, cw, h, { border: LINE });
        let yy = y - pad;
        page.drawText(clean(s.label).toUpperCase(), { x: x + pad, y: yy - 8, size: 8.5, font: FB, color: NAVY });
        yy -= 22;
        page.drawText(clean(s.name || " "), { x: x + pad, y: yy - 10, size: 10, font: FB, color: BLACK });
        yy -= 30;
        page.drawText("Ort, Datum", { x: x + pad, y: yy - 8, size: 8, font: F, color: GREY });
        if (s.ortDatum) page.drawText(clean(s.ortDatum), { x: x + pad, y: yy - 20, size: 10, font: F, color: BLACK });
        page.drawLine({ start: { x: x + pad, y: yy - 24 }, end: { x: x + cw - pad, y: yy - 24 }, thickness: 0.6, color: GREY });
        const ortY = yy - 20;
        yy -= 64;
        if (i === 0) vsig = [doc.getPageCount() - 1, x + pad, ortY, yy + 1, cw - 2 * pad].map((n) => Math.round(n * 10) / 10).join(",");
        if (s.bild) {
          const bytes = Uint8Array.from(atob(s.bild.split(",")[1]), (c) => c.charCodeAt(0));
          const img = await doc.embedPng(bytes);
          const sc = Math.min((cw - 2 * pad) / img.width, 34 / img.height);
          page.drawImage(img, { x: x + pad, y: yy + 1, width: img.width * sc, height: img.height * sc });
        }
        page.drawLine({ start: { x: x + pad, y: yy }, end: { x: x + cw - pad, y: yy }, thickness: 0.6, color: GREY });
        page.drawText("Unterschrift", { x: x + pad, y: yy - 11, size: 8, font: F, color: GREY });
      }
      y -= h + 8;
    } else if (blk.t === "note") {
      y -= 4;
      absatz([{ text: blk.text }], { size: 7.5, lh: 10.5, color: GREY });
    }
  }

  if (vsig) doc.setKeywords([`vsig:${vsig}`]);
  const seiten = doc.getPages();
  seiten.forEach((pg, i) => {
    pg.drawLine({ start: { x: M.l, y: 50 }, end: { x: A4[0] - M.r, y: 50 }, thickness: 0.6, color: LINE });
    const links = clean(`${titel}${id ? " · Vertrags-ID " + id : ""}`);
    pg.drawText(links, { x: M.l, y: 36, size: 8, font: F, color: GREY });
    const rechts = `Seite ${i + 1} von ${seiten.length}`;
    pg.drawText(rechts, { x: A4[0] - M.r - F.widthOfTextAtSize(rechts, 8), y: 36, size: 8, font: F, color: GREY });
  });
  return doc.save();
}
