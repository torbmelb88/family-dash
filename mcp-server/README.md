# Family Dash MCP-server

Ekstern MCP-server (Model Context Protocol) som lar Claude på claude.ai — inkludert
mobilappen — lese og skrive middagsplaner og handlelister direkte i Family Dash.

Kjører som en Cloud Function (2nd gen, `europe-west1`) i samme Firebase-prosjekt som
appen. Fordi den bruker `firebase-admin` med prosjektets innebygde tjenestekonto,
trengs ingen nøkkelfiler, og Firestore security rules (som er UID-låst for klienter)
er ikke i veien.

## Verktøy

| Verktøy | Gjør |
| --- | --- |
| `list_dinners` | Søk/list i middagsarkivet |
| `add_dinner` | Legg ny oppskrift i middagsarkivet (ingredienser, lenke, steg …) |
| `get_week_plan` | Hent ukeplanen med oppløste middagsnavn |
| `plan_dinner` | Legg en middag på en gitt dato |
| `remove_planned_dinner` | Fjern planlagt middag fra en dato |
| `get_shopping_lists` | List handlelister med kategorier |
| `get_shopping_items` | Hent varene på en liste |
| `add_shopping_items` | Legg varer i en liste (bruker `categoryHistory` for automatisk kategori) |

Familien slås opp via `users/{OWNER_UID}.familyId` (samme UID som i `firestore.rules`).

## Autentisering

Serveren er "authless" mot claude.ai, men krever en hemmelig token i URL-stien
(eller som `Authorization: Bearer` / `x-api-key`-header, for kontoer som har
request header-støtten). Uten gyldig token svarer den 401 på alt.

Tokenen ligger i `.env` (gitignorert — **aldri** commit den; repoet er offentlig):

```
MCP_SECRET=<lang tilfeldig streng>
OWNER_UID=<eierens Firebase Auth UID>
```

## Deploy

```bash
# fra repo-roten
firebase deploy --only functions
```

Endepunktet blir:

```
https://europe-west1-family-dash-10510.cloudfunctions.net/mcp/<MCP_SECRET>
```

## Koble til claude.ai

1. Gå til **Settings → Connectors** (eller **Customize → Connectors**) på claude.ai
2. Velg **Add custom connector**
3. Lim inn URL-en over (med tokenen i stien). La OAuth-feltene stå tomme.
4. I en samtale: åpne **+**-menyen → **Connectors** og slå på Family Dash

Connectoren blir tilgjengelig i mobilappen på samme konto. Eksempler på bruk:

> «Finn en god oppskrift på lakseplukkfisk, legg den i middagsarkivet, planlegg
> den til torsdag og legg ingrediensene i handlelista.»

## Rotere tokenen

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Oppdater `MCP_SECRET` i `.env`, kjør `firebase deploy --only functions`, og
oppdater URL-en i connectoren på claude.ai.

## Lokal testing

```bash
firebase emulators:start --only functions
# endepunkt: http://127.0.0.1:5001/family-dash-10510/europe-west1/mcp/<MCP_SECRET>
```

NB: emulatoren snakker med **produksjons**-Firestore (via CLI-innloggingen din).

## Sikkerhetsvurdering

Tokenen er i praksis et tilgangskort: alle som har URL-en kan lese/endre familiens
middagsplaner og handlelister (men ikke noe annet — verktøyene er avgrenset til
disse collections). Datainnholdet er lite sensitivt, og tokenen kan roteres på
minutter. Vurder full OAuth 2.1 hvis omfanget vokser.
