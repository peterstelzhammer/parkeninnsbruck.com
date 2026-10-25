# parkeninnsbruck.com

Website für die provisionsfreie Vermietung von Tiefgaragen-Stellplätzen in Innsbruck (Kaiserjägergarage bei SOWI, MCI und Sicherheitszentrum Tirol sowie Innrain 36b gegenüber der Klinik).

Statische Seite ohne Build-Schritt, gehostet auf Cloudflare Pages.

| Datei | Zweck |
|---|---|
| `index.html` | Komplette Website (DE/EN, mobile first, keine externen Abhängigkeiten, keine Cookies) |
| `robots.txt` | Erlaubt Suchmaschinen und KI-Crawler, verweist auf die Sitemap |
| `sitemap.xml` | Sitemap für Google Search Console / Bing Webmaster Tools |
| `llms.txt` | Kurzbeschreibung des Angebots für KI-Assistenten |
| `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` | Favicon und App-Icons |

## Cloudflare Pages

- Framework preset: **None**
- Build command: *(leer)*
- Build output directory: `/`
