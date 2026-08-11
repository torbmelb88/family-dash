# Family Dash MCP-server

En ekstern [MCP](https://modelcontextprotocol.io)-server (Model Context Protocol)
som gjør Family Dash tilgjengelig som **custom connector** i Claude på
[claude.ai](https://claude.ai) — inkludert mobilappen. Da kan Claude finne en
oppskrift, legge den i middagsarkivet, planlegge den på en ukedag og legge
ingrediensene i handlelisten — i én og samme samtale:

> «Finn en god oppskrift på lakseplukkfisk, legg den i middagsarkivet, planlegg
> den til torsdag og legg ingrediensene i handlelista.»

Serveren kjører som en Cloud Function (2nd gen) i samme Firebase-prosjekt som
appen. Den bruker `firebase-admin` med prosjektets innebygde tjenestekonto —
ingen nøkkelfiler trengs, og de UID-låste Firestore-reglene som beskytter
klienttilgangen berøres ikke.

Siden MCP er en åpen standard fungerer serveren også med andre klienter som
støtter remote MCP over Streamable HTTP, f.eks. ChatGPT (utviklermodus),
Cursor og VS Code.

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
| `add_shopping_items` | Legg varer i en liste (bruker kategorihistorikken, så varer automatisk havner i riktig kategori) |

## Oppsett

Forutsetter et Firebase-prosjekt med Family Dash i drift (se
[hoved-README-en](../README.md)) på **Blaze-plan** — Cloud Functions er ikke
tilgjengelig på gratisplanen. Forbruket for en familie ligger godt innenfor
gratiskvoten.

```bash
cd mcp-server
npm install
cp .env.example .env
```

Fyll inn `.env`:

```
MCP_SECRET=<lang tilfeldig streng>   # generer: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
OWNER_UID=<Firebase Auth UID>        # samme UID som i firestore.rules
```

`MCP_SECRET` er tilgangsnøkkelen (se [Autentisering](#autentisering)).
`OWNER_UID` brukes til å slå opp riktig familie via `users/{uid}.familyId`.
`.env` er gitignorert og skal ikke committes.

Deploy fra repo-roten:

```bash
firebase deploy --only functions
```

Endepunktet blir:

```
https://europe-west1-<PROSJEKT-ID>.cloudfunctions.net/mcp/<MCP_SECRET>
```

## Koble til claude.ai

1. Gå til **Settings → Connectors → Add custom connector** på claude.ai
2. Lim inn endepunkt-URL-en (med `MCP_SECRET` i stien). La OAuth-feltene stå tomme.
3. I en samtale: åpne **+**-menyen → **Connectors** og slå på connectoren

Connectoren blir tilgjengelig i mobilappen på samme konto.

## Autentisering

Serveren er «authless» i MCP-forstand, men krever den hemmelige tokenen i
URL-stien — alternativt som `Authorization: Bearer`- eller `x-api-key`-header
for klienter som støtter det (på claude.ai er header-autentisering foreløpig i
beta). Uten gyldig token svarer serveren 401 på alt.

Sikkerhetsmodellen er altså en *capability-URL*: alle som kjenner URL-en kan
lese og endre middagsplaner og handlelister — men ikke noe annet; verktøyene er
avgrenset til disse collections, og dataene er lite sensitive. Tokenen roteres
på minutter ved behov: generer en ny `MCP_SECRET` i `.env`, deploy på nytt, og
oppdater URL-en i connectoren. Vurder full OAuth 2.1 hvis omfanget vokser.

## Lokal testing

```bash
firebase emulators:start --only functions
# endepunkt: http://127.0.0.1:5001/<PROSJEKT-ID>/europe-west1/mcp/<MCP_SECRET>
```

Merk at Functions-emulatoren bruker Firebase CLI-innloggingen og snakker med
**produksjons**-Firestore, ikke en lokal kopi.
