## Konta Admin

Internes Dashboard für Konta (siehe README). Liest die Datenbank der Konta-App
(`das-felix/konta_app`) ausschließlich lesend und OpenPanel über die Export-API.

- **SvelteKit 3**: Config in `vite.config.js` (`sveltekit({...})`), kein
  `svelte.config.js`. Imports aus `src/lib` über `#lib/...`. Env-Variablen in
  `src/env.js` (`defineEnvVars`), Zugriff über `$app/env/private`. `resolve()`
  nimmt Route-IDs mit Gruppen (`resolve('/(admin)/nutzer/[id]', { id })`).
  Link-Option `data-sveltekit-reset="false"` statt `noscroll`/`keepfocus`.
- **Typen**: JavaScript mit JSDoc, `checkJs`. `npm run check` muss ohne Fehler
  laufen. Casts per `/** @type {X} */ (expr)`.
- **Datenbank**: nur `SELECT`. Spaltennamen sind camelCase in Anführungszeichen
  (Prisma-Default), Tabellen per `@@map` (siehe `konta_app/prisma/schema.prisma`).
  Zeitstempel sind UTC ohne Zone; Tagesgrenzen über `viennaDate()` /
  `viennaDayStart()` aus `src/lib/server/db.js`.
- **Design und Texte**: wie in der Konta-App, also Konta-Styleguide
  (`konta_app/docs/design/konta-styleguide.md`) und die Regeln aus
  `konta_app/AGENTS.md` (Abschnitte Design und Copywriting): nur
  `green`/`violet`/`ink`-Töne, Karten mit `border-ink/7` + `shadow-card`,
  `.text-label` für Eyebrows und Tabellenköpfe, Segmented Controls statt Pillen,
  Diagramm-Reihenfolge `ink` → `violet-700` → `green` → `ink-400` → `ink-200`.
  Du-Form, österreichisches Deutsch, keine Gedankenstriche, nie „KI“.
