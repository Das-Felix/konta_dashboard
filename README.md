# Konta Admin

Internes Admin- und Analytics-Dashboard für Konta. Liest die Datenbank der
Konta-App (nur lesend) und die Produktereignisse aus OpenPanel und führt beides
pro Konto zusammen: für Nutzerverhalten, Wachstum und Support.

Gebaut mit SvelteKit 3, Svelte 5, Tailwind 4 und JavaScript mit JSDoc-Typen.
Gestaltung nach dem Konta-Styleguide (Tokens 1:1 aus `konta_app/src/routes/layout.css`).

## Ansichten

| Route          | Inhalt                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` Übersicht  | Nutzer gesamt, Registrierungen heute, aktive Nutzer, MRR, Verlauf Registrierungen und Aktive, Trichter, was heute in Konta passiert ist, Auffälligkeiten, Besucher aus OpenPanel, neueste Registrierungen, letzte Aktivität                                                                                                                                                                                                         |
| `/nutzer`      | Alle Konten mit Suche (Name, E-Mail, Unternehmen, Telefon, ID), Filter nach Abo-Status und Onboarding, Sortierung                                                                                                                                                                                                                                                                                                                   |
| `/nutzer/[id]` | **Alles zu einem Konto an einem Ort**: Stammdaten, Abo, Unternehmen, Onboarding und Umfrage, Leitfaden, Geräte und Sessions, Logins, genutzte Funktionen, Probleme (fehlgeschlagene Belegerkennung, Dauerrechnungen, Mailzustellung), Aktivitätskalender und eine **Zeitleiste**, die Änderungsprotokoll, Logins, Benachrichtigungen, Kontomeilensteine und OpenPanel-Ereignisse zusammenführt. Direktlinks zu OpenPanel und Stripe |
| `/wachstum`    | Registrierungen pro Woche und Tag, Trichter, Akquise-Kanäle, bisher genutzte Tools, Steuerstatus, Steuerberatung, wo das Onboarding hängt, Bindung nach Registrierungswoche                                                                                                                                                                                                                                                         |
| `/abos`        | MRR, zahlende Abos nach Tarif, Status aller Unternehmen, Test-zu-Abo-Quote, Tests die bald enden, Zahlungsprobleme und Kündigungen                                                                                                                                                                                                                                                                                                  |
| `/nutzung`     | Aktive Nutzer pro Tag, Belege und Rechnungen pro Tag, Funktionen im Einsatz, häufigste Aktionen, Belegerkennung (Fehler- und Korrekturquote), Hintergrundjobs und Mailzustellung                                                                                                                                                                                                                                                    |
| `/aktivitaet`  | Änderungsprotokoll über alle Unternehmen mit Vorher und Nachher, fehlgeschlagene Logins der letzten 24 Stunden                                                                                                                                                                                                                                                                                                                      |
| `/analytics`   | OpenPanel: Besucher, Sessions, Seitenaufrufe, meistbesuchte Seiten, wichtige Ereignisse, Live-Strom mit aufgelösten Kontonamen                                                                                                                                                                                                                                                                                                      |

## Wie die Daten zusammenkommen

- **Datenbank**: direkte SQL-Abfragen (`pg`) gegen das Prisma-Schema der App
  (`src/lib/server/queries/*`). Jede Verbindung läuft mit
  `default_transaction_read_only = on`, das Dashboard kann also nichts ändern.
  Tage zählen nach Wiener Zeit.
- **OpenPanel**: die App identifiziert eingeloggte Nutzer mit ihrer User-ID
  (`profileId`), serverseitige Ereignisse tragen dieselbe ID. Das Dashboard
  holt über die Export-API (`/export/events`, `/export/charts`) die Ereignisse
  eines Profils und legt sie in der Zeitleiste neben die Datenbankeinträge
  (`src/lib/timeline.js`). Im Live-Strom werden profileIds zu Namen aufgelöst.
  OpenPanel wird gestreamt: Seiten laden sofort mit den DB-Daten, ein Ausfall
  der API blendet nur die betroffenen Karten aus.
- **Aktiv** heißt: Session-Aktivität, erfolgreicher Login oder ein Eintrag im
  Änderungsprotokoll im Zeitraum.

## Anmeldung

Kein eigenes Benutzerkonto: Admins melden sich mit ihrem **Konta-Konto** an,
wenn die E-Mail in `ADMIN_EMAILS` steht. Passwort (Argon2id) und 2FA (TOTP)
werden gegen die Konta-Datenbank geprüft. Ist 2FA aktiv, braucht das Dashboard
denselben `TWO_FACTOR_SECRET_KEY` wie die App. Die Session ist ein signiertes
Cookie (12 Stunden, HttpOnly, Secure, SameSite=Strict). Wer aus `ADMIN_EMAILS`
entfernt wird, verliert den Zugang sofort.

## Einrichtung

```sh
npm ci
cp .env.example .env   # Werte eintragen
npm run dev
```

### Lese-Rolle in Postgres (empfohlen)

```sql
CREATE ROLE konta_dashboard LOGIN PASSWORD '…';
GRANT CONNECT ON DATABASE buchhaltungssoftware TO konta_dashboard;
GRANT USAGE ON SCHEMA public TO konta_dashboard;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO konta_dashboard;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO konta_dashboard;
```

### OpenPanel

Im OpenPanel-Projekt unter Einstellungen einen **eigenen Client im Modus
„read“** anlegen (der Tracking-Client der App darf nur schreiben) und
`OPENPANEL_CLIENT_ID` und `OPENPANEL_CLIENT_SECRET` setzen. Ein read-Client
gehört zu genau einem Projekt, `OPENPANEL_PROJECT_ID` braucht es daher nur bei
einem root-Client (die ID steht in der Dashboard-URL:
`https://dashboard.openpanel.dev/<org>/<projekt-id>`). Optional
`OPENPANEL_DASHBOARD_URL` für Direktlinks zu Profilen.

### Lokale Demo-Daten

Gegen eine **lokale** Datenbank mit dem Schema der App
(`npx prisma migrate deploy` im konta_app-Repo):

```sh
npm run db:seed-demo
```

Legt rund 190 erfundene Konten mit Belegen, Rechnungen, Logins und
Änderungsprotokoll an. Login danach `admin@konta.at` / `konta-demo`
(`ADMIN_EMAILS="admin@konta.at"`). Das Skript bricht ab, wenn
`DATABASE_URL` nicht auf localhost zeigt.

## Betrieb

```sh
npm run build
node build
```

Oder per `Dockerfile` (Port 3000). Der Build braucht keine Secrets; fehlen
Pflichtwerte beim Start, beendet sich der Server mit einer Liste der
fehlenden Variablen.

Hinter einem TLS-Proxy betreiben. SvelteKit 3 leitet den Origin aus dem
`Host`-Header und `https` ab; bei abweichendem Setup `PROTOCOL_HEADER` /
`HOST_HEADER` setzen. Das Dashboard enthält personenbezogene Daten: nur
intern erreichbar machen (VPN oder IP-Allowlist zusätzlich zur Anmeldung).

## Entwicklung

```sh
npm run check   # svelte-check (JSDoc-Typen)
npm run lint    # prettier + eslint
npm test        # vitest
```

Schemaänderungen in der App, die hier gelesene Spalten betreffen, müssen in
`src/lib/server/queries/*` nachgezogen werden. Labels für neue Enum-Werte und
Analytics-Ereignisse stehen in `src/lib/labels.js`, Tarifpreise in
`src/lib/plans.js`.
