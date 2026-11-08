// Konfiguration der Mietverträge.
// Personenbezogene Daten (Adresse, Telefon, Bankverbindung, Kontakte der Garagenverwaltung)
// stehen NICHT im Repo, sondern im Cloudflare-Secret VERTRAG_CONFIG (JSON, siehe README).

export const STANDORTE = {
  kaiserjaeger: {
    label: "Kaiserjägergarage",
    adresse: "Kaiserjägergarage, Kaiserjägerstraße 4a, 6020 Innsbruck",
    plaetze: ["111", "112", "113", "114"],
    zusatz: "",
    // Zutrittsmedium und zuständige Stelle
    medium: { nom: "eine Schlüsselkarte", akk: "die Schlüsselkarte", gen: "der Schlüsselkarte", dat: "der Karte", Nom: "Die Schlüsselkarte" },
    stelle: "die Garagenverwaltung",
    pfand: 20,
  },
  innrain: {
    label: "Tiefgarage Innrain",
    adresse: "Tiefgarage Innrain, Innrain 36b, 6020 Innsbruck",
    plaetze: ["31"],
    zusatz: "Es handelt sich um einen Stapelparker; die maximale Fahrzeughöhe beträgt 1,50 m.",
    medium: { nom: "ein Schlüssel", akk: "den Schlüssel", gen: "des Schlüssels", dat: "dem Schlüssel", Nom: "Der Schlüssel" },
    stelle: "die Hausverwaltung",
    pfand: 100,
  },
};

const FEHLT = "[nicht konfiguriert]";

const DEFAULT = {
  vermieter: { name: FEHLT, strasse: FEHLT, plzOrt: FEHLT, staat: "Österreich", telefon: FEHLT, email: FEHLT },
  konto: { inhaber: FEHLT, bank: FEHLT, iban: FEHLT, bic: FEHLT },
  // Kontakt bei Problemen mit Schlüsselkarte/Schlüssel, je Standort, z. B. "Name, Tel. …"
  kontakte: { kaiserjaeger: FEHLT, innrain: FEHLT },
  // Empfänger der Benachrichtigung bei neuen Verträgen (muss in Cloudflare Email Routing verifiziert sein)
  benachrichtigung: "",
  absender: "vertrag@parkeninnsbruck.com",
};

export function loadConfig(env) {
  let c = {};
  try {
    c = env.VERTRAG_CONFIG ? JSON.parse(env.VERTRAG_CONFIG) : {};
  } catch {
    c = {};
  }
  return {
    vermieter: { ...DEFAULT.vermieter, ...(c.vermieter || {}) },
    konto: { ...DEFAULT.konto, ...(c.konto || {}) },
    kontakte: { ...DEFAULT.kontakte, ...(c.kontakte || {}) },
    benachrichtigung: c.benachrichtigung || DEFAULT.benachrichtigung,
    absender: c.absender || DEFAULT.absender,
  };
}

export const TOKEN_TAGE = 30;
export const MAX_EINREICHUNGEN = 5;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
