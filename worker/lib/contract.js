// Baut den Vertragstext als neutrale Blockstruktur (für PDF und HTML-Vorschau).
import { STANDORTE } from "./config.js";

const MONATE = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export function euro(n) {
  return "EUR " + n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, ".");
}

function datumLang(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${MONATE[m - 1]} ${y}`;
}

function monatJahr(iso) {
  const [y, m] = iso.split("-").map(Number);
  return `${MONATE[m - 1]} ${y}`;
}

// 1 % von 36 Monatsmieten (unbefristeter Bestandvertrag: dreifacher Jahreswert)
export function vertragsgebuehr(miete) {
  return Math.round(miete * 36) / 100;
}

// Heutiges Datum in Wien als ISO (JJJJ-MM-TT)
export function heuteWien() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Vienna" });
}

// Bei Vertragsabschluss fällige Mieten: ab Mietbeginn bis einschließlich laufendem Monat
// (Miete ist im Voraus fällig). Liegt der Beginn in der Zukunft, ist es die erste Monatsmiete.
export function faelligeMiete(k, heute = heuteWien()) {
  const [by, bm, bd] = k.beginn.split("-").map(Number);
  const [hy, hm] = heute.split("-").map(Number);
  const start = by * 12 + (bm - 1);
  const jetzt = hy * 12 + (hm - 1);
  const monate = Math.max(1, jetzt - start + 1);
  const ende = start + monate - 1;
  // Erster Monat tagesgenau, wenn der Mietbeginn nicht der Monatserste ist
  const tageImMonat = new Date(Date.UTC(by, bm, 0)).getUTCDate();
  const tage = tageImMonat - bd + 1;
  const anteilig = bd > 1;
  const ersterMonat = anteilig ? Math.round(((k.miete * tage) / tageImMonat) * 100) / 100 : k.miete;
  const betrag = Math.round((ersterMonat + k.miete * (monate - 1)) * 100) / 100;
  const name = (i) => MONATE[i % 12];
  const jahr = (i) => Math.floor(i / 12);
  let label;
  if (monate === 1) label = `Miete ${name(start)} ${jahr(start)}`;
  else if (jahr(start) === jahr(ende)) label = `Miete ${name(start)} bis ${name(ende)} ${jahr(ende)}`;
  else label = `Miete ${name(start)} ${jahr(start)} bis ${name(ende)} ${jahr(ende)}`;
  const zusatz = [];
  if (monate > 1) zusatz.push(`${monate} Monate`);
  if (anteilig) zusatz.push(`${name(start)} anteilig ab ${bd}., ${tage} von ${tageImMonat} Tagen`);
  if (zusatz.length) label += ` (${zusatz.join("; ")})`;
  return { monate, betrag, label, rueckwirkend: monate > 1, anteilig, ersterMonat };
}

export function summen(k, heute = heuteWien()) {
  const gebuehr = vertragsgebuehr(k.miete);
  const miete = faelligeMiete(k, heute);
  const posten = [[miete.label, miete.betrag]];
  if (k.gebuehrMieter) posten.push(["Vergebührung", gebuehr]);
  if (k.kaution > 0) posten.push(["Kaution", k.kaution]);
  if (k.pfand > 0) posten.push([`Pfand ${STANDORTE[k.standort].medium.akk.replace(/^\S+ /, "")}`, k.pfand]);
  const gesamt = Math.round(posten.reduce((s, [, b]) => s + b, 0) * 100) / 100;
  return { gebuehr, posten, gesamt, miete };
}

const LEER = "";

// Prüft die Mieterangaben. Gibt { fehler, m } zurück.
export function pruefeMieter(input) {
  const e = [];
  const t = (v, max = 120) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
  const m = {
    name: t(input.name),
    strasse: t(input.strasse),
    plzOrt: t(input.plzOrt),
    staat: t(input.staat || "Österreich", 60),
    telefon: t(input.telefon, 40),
    email: t(input.email, 120),
    ort: t(input.ort || "Innsbruck", 60),
    kennzeichen: (Array.isArray(input.kennzeichen) ? input.kennzeichen : [])
      .map((k) => t(k, 15).toUpperCase())
      .filter(Boolean)
      .slice(0, 5),
  };
  if (m.name.length < 3) e.push("Name fehlt.");
  if (m.strasse.length < 3) e.push("Straße fehlt.");
  if (m.plzOrt.length < 4) e.push("PLZ / Ort fehlt.");
  if (m.telefon.length < 6) e.push("Telefonnummer fehlt.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) e.push("E-Mail-Adresse ungültig.");
  if (m.kennzeichen.length < 1) e.push("Mindestens ein Kennzeichen angeben.");
  return { fehler: e, m };
}

// k = Konditionen aus dem Token, m = Mieter (oder null für leere Vorlage), cfg = Konfiguration
// sig = { datum, bild? } für die Unterschrift des Mieters (optional)
export function baueVertrag(k, m, cfg, sig = null) {
  const s = STANDORTE[k.standort];
  const v = cfg.vermieter;
  const mm = m || { name: LEER, strasse: LEER, plzOrt: LEER, staat: LEER, telefon: LEER, email: LEER, kennzeichen: [], ort: LEER };
  const { gebuehr, posten, gesamt, miete } = summen(k);
  const B = [];
  const p = (...runs) => B.push({ t: "p", runs: runs.map((r) => (typeof r === "string" ? { text: r } : r)) });
  const b = (text) => ({ text, b: true });
  let nr = 0;
  const h = (text) => B.push({ t: "h", text: `§ ${++nr} ${text}` });

  B.push({ t: "title", text: "Mietvertrag über einen Kfz-Stellplatz" });
  B.push({
    t: "parties",
    left: {
      label: "Vermieter",
      rows: [["Name", v.name], ["Straße", v.strasse], ["PLZ / Ort", v.plzOrt], ["Staat", v.staat], ["Telefon", v.telefon], ["E-Mail", v.email]],
    },
    right: {
      label: "Mieter",
      rows: [["Name", mm.name], ["Straße", mm.strasse], ["PLZ / Ort", mm.plzOrt], ["Staat", mm.staat], ["Telefon", mm.telefon], ["E-Mail", mm.email]],
    },
  });

  h("Mietsache");
  p("Der Vermieter vermietet dem Mieter zum Abstellen von Kraftfahrzeugen einen offenen, nicht absperrbaren Stellplatz in der Tiefgarage:");
  p(b(`Adresse: ${s.adresse}, Stellplatz Nr. ${k.platz}`));
  if (s.zusatz) p(s.zusatz);
  const kz = mm.kennzeichen.length ? mm.kennzeichen.join(", ") : "____________________";
  p(mm.kennzeichen.length > 1 ? "Kennzeichen der abgestellten Fahrzeuge: " : "Kennzeichen des abgestellten Fahrzeuges: ", b(kz));
  p("Ein Wechsel des Fahrzeuges ist dem Vermieter unverzüglich bekanntzugeben.");

  h("Mietzins");
  p(
    "Der monatliche Mietzins beträgt ",
    b(`${euro(k.miete)} einschließlich Nebenkosten`),
    ". Der Vermieter ist Kleinunternehmer gemäß § 6 Abs. 1 Z 27 UStG; der Mietzins enthält daher keine Umsatzsteuer. " +
      `Es wird ${s.medium.nom} für die Tiefgarage zur Verfügung gestellt. Bei Verlust sind die tatsächlichen Kosten für ` +
      `${s.medium.akk} lt. Hausverwaltung zu tragen. Bei Problemen mit ${s.medium.dat} steht ${s.stelle} ` +
      `(${cfg.kontakte[k.standort]}) zur Verfügung.`
  );
  p("Die Miete ist monatlich spätestens am fünften Werktag eines jeden Monats im Voraus an den Vermieter zu entrichten.");

  h("Vergebührung");
  if (k.gebuehrMieter) {
    p(
      "Die Vermieterin/der Vermieter ist verpflichtet, die Gebühr selbst zu berechnen und an das Finanzamt für Gebühren, " +
        "Verkehrsteuern und Glücksspiel abzuführen. Die Kosten der Vergebührung werden von der Vermieterin/dem Vermieter an den " +
        "Mieter weiterverrechnet (",
      b(euro(gebuehr)),
      "); dieser Betrag ist mit der ersten Monatsmiete zu überweisen."
    );
  } else {
    p(
      "Die Vermieterin/der Vermieter ist verpflichtet, die Gebühr selbst zu berechnen und an das Finanzamt für Gebühren, " +
        "Verkehrsteuern und Glücksspiel abzuführen. Die Kosten der Vergebührung trägt die Vermieterin/der Vermieter zur Gänze; " +
        "sie werden dem Mieter nicht weiterverrechnet."
    );
  }

  if (k.kaution > 0) {
    h("Kaution");
    p(
      `Die Kaution beträgt ${euro(k.kaution)} und ist mit der ersten Monatsmiete zu überweisen. Sie wird nach Beendigung des ` +
        `Mietverhältnisses und Rückgabe ${s.medium.gen} binnen 14 Tagen zurückbezahlt; der Vermieter ist berechtigt, offene ` +
        "Forderungen aus dem Mietverhältnis mit der Kaution aufzurechnen."
    );
  }

  if (k.pfand > 0) {
    h(`Pfand für ${s.medium.akk}`);
    p(
      `Für ${s.medium.akk} ist ein Pfand von ${euro(k.pfand)} mit der ersten Monatsmiete zu überweisen. Das Pfand wird nach ` +
        `Beendigung des Mietverhältnisses und Rückgabe ${s.medium.gen} in funktionsfähigem Zustand binnen 14 Tagen zurückbezahlt. ` +
        `Bei Verlust oder Beschädigung wird es mit den tatsächlichen Ersatzkosten verrechnet.`
    );
  }

  h("Zahlung");
  if (posten.length > 1 || miete.rueckwirkend || miete.anteilig) {
    B.push({
      t: "pay",
      intro: miete.rueckwirkend
        ? "Da das Mietverhältnis bereits begonnen hat, sind bei Vertragsabschluss die Mieten ab Mietbeginn bis einschließlich des laufenden Monats fällig" + (miete.anteilig ? "; der erste Monat wird tagesgenau berechnet" : "") + ". Zu überweisen sind:"
        : miete.anteilig
          ? "Die Miete für den ersten Monat wird tagesgenau ab Mietbeginn berechnet. Zu überweisen sind:"
          : "Mit der ersten Monatsmiete sind zu überweisen:",
      rows: posten.map(([n, betrag]) => [n, euro(betrag)]),
      total: ["Gesamt", euro(gesamt)],
    });
  }
  B.push({
    t: "kv",
    intro: "Die Zahlungen sind auf das folgende Konto zu überweisen:",
    rows: [["Kontoinhaber", cfg.konto.inhaber], ["Kreditinstitut", cfg.konto.bank], ["IBAN", cfg.konto.iban], ["BIC", cfg.konto.bic]],
  });

  h("Mietzeit");
  p(`Das Mietverhältnis beginnt am ${datumLang(k.beginn)}.`);

  h("Kündigung des Mietverhältnisses");
  p(
    "Der Mietvertrag wird unbefristet abgeschlossen. Beide Parteien sind berechtigt, den Vertrag unter Einhaltung einer " +
      "Kündigungsfrist von zwei Monaten zum Ende eines Kalendermonats schriftlich zu kündigen; eine Kündigung per E-Mail ist ausreichend."
  );
  p(
    "Der Vermieter ist zur fristlosen Kündigung berechtigt, wenn der Mieter mit einem Betrag, der zwei Monatsmieten übersteigt, " +
      "im Rückstand ist oder wenn der Mieter den Stellplatz vertragswidrig benutzt."
  );

  h("Wertsicherung");
  p(
    "Der Mietzins ist wertgesichert; es gilt die Wertsicherung nach § 1 Abs. 2 Mieten-Wertsicherungsgesetz (MieWeG) in " +
      "sinngemäßer Anwendung. Der Mietzins ändert sich jeweils zum 1. April eines Jahres, erstmals zum 1. April des auf den " +
      "Mietbeginn folgenden Kalenderjahres, im Ausmaß der durchschnittlichen Veränderung des von der Statistik Austria " +
      "verlautbarten Verbraucherpreisindex 2020 (oder eines an seine Stelle tretenden Index) im vorangegangenen Kalenderjahr " +
      "gegenüber dem davorliegenden Kalenderjahr. Übersteigt diese Veränderung 3 %, wird der 3 % übersteigende Teil nur zur " +
      "Hälfte berücksichtigt. Bei der ersten Anpassung wird die Veränderung nur im Verhältnis der vollen Kalendermonate des " +
      "Mietverhältnisses im vorangegangenen Kalenderjahr zu zwölf Monaten berücksichtigt. Ein Rückgang des Index führt zu " +
      "einer entsprechenden Senkung. Der geänderte Betrag wird auf ganze Cent gerundet."
  );
  p(
    "Der Vermieter teilt dem Mieter den geänderten Mietzins schriftlich mit; eine Mitteilung per E-Mail genügt. Der geänderte " +
      "Betrag ist ab dem 1. April zu zahlen, frühestens jedoch ab dem ersten Zinstermin nach Zugang der Mitteilung. Eine " +
      "rückwirkende Nachforderung für Zeiträume vor Zugang der Mitteilung ist ausgeschlossen."
  );

  h("Benützung des Stellplatzes");
  p(
    "Eine andere als die vereinbarte Nutzung ist nicht gestattet. Der Mieter darf auf dem Stellplatz keine sonstigen Gegenstände " +
      "lagern. Die Lagerung brennbarer oder explosiver Stoffe ist untersagt. Eine Ladestation für Elektrofahrzeuge ist nicht " +
      "vorhanden; das Laden von Elektrofahrzeugen auf dem Stellplatz ist nicht gestattet. Die jeweils gültige Garagen- bzw. " +
      "Hausordnung ist einzuhalten."
  );

  h("Untervermietung");
  p("Eine Untervermietung oder sonstige Überlassung des Stellplatzes an Dritte ist ohne vorherige schriftliche Zustimmung des Vermieters nicht gestattet.");

  h("Haftung");
  p(
    "Eine Bewachung oder Verwahrung des eingestellten Fahrzeuges ist nicht Gegenstand des Vertrages. Der Vermieter haftet " +
      "für Sachschäden nur bei Vorsatz oder grober Fahrlässigkeit; für Personenschäden haftet er nach den gesetzlichen " +
      "Bestimmungen. Beschädigungen am Mietobjekt und am Einfahrtsbereich zum " +
      "Mietobjekt gehen zu Lasten des Mieters, sofern sie vom Mieter oder von ihm zuzurechnenden Personen verursacht wurden."
  );
  p("Der Mieter haftet für Verunreinigungen durch Öl oder Benzin sowie für alle Schäden, die bei der Benutzung des Stellplatzes schuldhaft verursacht werden.");

  h("Rückgabe");
  p(
    "Bei Beendigung des Mietverhältnisses ist der Stellplatz geräumt und gereinigt zurückzugeben. " +
      `${s.medium.Nom} ist spätestens am letzten Tag des Mietverhältnisses an den Vermieter zu retournieren.`
  );

  h("Ausschluss");
  p("Das Vertragsverhältnis unterliegt nicht den Bestimmungen des Mietrechtsgesetzes.");
  p("Jede Änderung des Vertrages bedarf der Schriftform.");
  p("Dieser Vertrag wird in zwei Ausfertigungen errichtet; jede Vertragspartei erhält eine Ausfertigung.");

  B.push({
    t: "sign",
    left: { label: "Vermieter", name: v.name, ortDatum: "", bild: null },
    right: {
      label: "Mieter",
      name: mm.name,
      ortDatum: sig ? `${mm.ort}, ${sig.datum}` : "",
      bild: sig?.bild || null,
    },
  });

  if (sig) {
    B.push({
      t: "note",
      text:
        `Der Mieter hat diesen Vertrag am ${sig.zeitpunkt} über parkeninnsbruck.com elektronisch unterzeichnet ` +
        `(einfache elektronische Signatur). Vertrags-ID ${k.id}, Prüfsumme der Vertragsdaten (SHA-256): ${sig.hash}.`,
    });
  }
  return B;
}

// Kanonische Darstellung der Vertragsdaten für die Prüfsumme
export async function vertragsHash(k, m) {
  const data = new TextEncoder().encode(JSON.stringify({ k, m }));
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(d, (x) => x.toString(16).padStart(2, "0")).join("");
}
