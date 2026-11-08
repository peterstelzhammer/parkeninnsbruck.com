# parkeninnsbruck.com

Website für die provisionsfreie Vermietung von Tiefgaragen-Stellplätzen in Innsbruck (Kaiserjägergarage bei SOWI, MCI und Sicherheitszentrum Tirol sowie Innrain 36b gegenüber der Klinik).

Statische Seite ohne Build-Schritt, ausgeliefert als Cloudflare Worker mit Static Assets (`wrangler.jsonc`). Der Worker (`worker/`) stellt zusätzlich die API für Online-Mietverträge bereit.

| Datei | Zweck |
|---|---|
| `index.html` | Komplette Website (DE/EN, mobile first, keine externen Abhängigkeiten, keine Cookies) |
| `robots.txt` | Erlaubt Suchmaschinen und KI-Crawler, verweist auf die Sitemap |
| `sitemap.xml` | Sitemap für Google Search Console / Bing Webmaster Tools |
| `llms.txt` | Kurzbeschreibung des Angebots für KI-Assistenten |
| `vertrag/` | Mieterseite (`/vertrag/?t=…`) und Admin-Bereich (`/vertrag/admin/`) für Mietverträge |
| `worker/` | Worker-Code: Vertragslinks, PDF-Erzeugung, Upload (siehe unten); wird nicht als Asset ausgeliefert (`.assetsignore`) |
| `wrangler.jsonc` | Worker-Konfiguration (Assets, R2-Binding) |
| `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` | Favicon und App-Icons |

## Deployment

Push auf `main` → Workers Builds führt `npx wrangler deploy` aus. Konfiguration steht in `wrangler.jsonc`.

## Mietverträge online abschließen

Ablauf:

1. **Admin** (`/vertrag/admin/`, Basic Auth, Benutzer `admin`): Standort, Stellplatz, Miete und Mietbeginn wählen, **festlegen, wer die Vertragsgebühr trägt und ob eine Kaution verlangt wird** (beides Pflicht, keine Vorauswahl), Vorschau prüfen, Link erzeugen und per Gmail/Mailprogramm an den Mieter schicken.
2. **Mieter** (`/vertrag/?t=…`, Link 30 Tage gültig, HMAC-signiert, Konditionen nicht veränderbar): Daten und bis zu 5 Kennzeichen eingeben, dann
   - **online unterschreiben** (einfache elektronische Signatur, PDF mit Zeitstempel und Prüfsumme), oder
   - **PDF herunterladen**, händisch unterschreiben, Scan hochladen, oder
   - **PDF herunterladen**, mit ID Austria auf a-trust.at/pdfsign signieren, hochladen.
3. Dokumente landen im privaten R2-Bucket; Übersicht, Download und Löschen im Admin-Bereich. Optional Benachrichtigung per E-Mail.

Vermieterdaten, Bankverbindung und Kontakte der Garagenverwaltung stehen **nicht im Repo**, sondern im Secret `VERTRAG_CONFIG`.

### Einrichtung in Cloudflare

1. R2-Bucket **`parkeninnsbruck-vertraege`** anlegen (privat). Die Bindung `VERTRAEGE` steht bereits in `wrangler.jsonc`.
2. Worker → Settings → **Variables and Secrets** (Typ *Secret*):

| Name | Inhalt |
|---|---|
| `ADMIN_PASSWORD` | Passwort für `/vertrag/admin/` (mind. 12 Zeichen) |
| `TOKEN_SECRET` | Zufallswert, mind. 32 Zeichen (z. B. `openssl rand -hex 32`); Änderung macht alle offenen Links ungültig |
| `VERTRAG_CONFIG` | JSON, siehe unten |

```json
{
  "vermieter": {"name": "…", "strasse": "…", "plzOrt": "…", "staat": "Österreich", "telefon": "…", "email": "…"},
  "konto": {"inhaber": "…", "bank": "…", "iban": "…", "bic": "…"},
  "kontakte": {"kaiserjaeger": "…", "innrain": "…"},
  "benachrichtigung": "empfaenger@example.com",
  "absender": "vertrag@parkeninnsbruck.com"
}
```

Optional: Send-Email-Binding **`MAIL`** in `wrangler.jsonc` ergänzen (`"send_email": [{"name": "MAIL"}]`) für die Benachrichtigung; Empfänger muss in Email Routing verifiziert sein. Ohne Binding funktioniert alles, nur ohne Mail.

**Empfohlen:** R2-Lifecycle-Regel, die Objekte unter `vertraege/` nach 60 Tagen löscht.

### Lokal testen

```bash
# .dev.vars mit ADMIN_PASSWORD, TOKEN_SECRET, VERTRAG_CONFIG anlegen (nicht committen)
npx wrangler dev
```

`functions/_lib/pdf-lib.esm.min.js` ist [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1 (MIT), eingebunden ohne Build-Schritt.
