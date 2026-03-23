# ODDSTRACKER - Fullstandig installationsguide

## Vad du behover innan du borjar

- En dator (Mac eller Windows)
- En iPhone
- Din The Odds API-nyckel (du har redan en)
- 15-20 minuter

---

## STEG 1: Installera Node.js (om du inte redan har det)

1. Oppna webblasaren
2. Ga till: https://nodejs.org
3. Klicka den grona knappen "LTS" (den vanstra)
4. Installera filen som laddas ner (klicka genom installern)
5. Starta om datorn efter installation

Verifiera att det fungerar:
- Mac: Oppna "Terminal" (sok i Spotlight)
- Windows: Oppna "Command Prompt" (sok i Start-menyn)

Skriv:
```
node --version
```
Du ska se nagonting som "v20.x.x". Om du ser det ar du redo.

---

## STEG 2: Installera Git (om du inte redan har det)

1. Ga till: https://git-scm.com
2. Klicka "Download for Mac" eller "Download for Windows"
3. Installera

---

## STEG 3: Skapa GitHub-konto

1. Ga till: https://github.com
2. Klicka "Sign up"
3. Folj stegen
4. Kom ihag ditt anvandarnamn

---

## STEG 4: Skapa Pushover-konto (push-notiser till iPhone)

1. Ladda ner "Pushover" fran App Store pa din iPhone (kostar ca 50 kr, engangskostnad)
2. Oppna appen och skapa ett konto
3. Ga till https://pushover.net/apps i webblasaren pa datorn
4. Klicka "Create New Application/API Token"
5. Name: "OddsTracker"
6. Klicka "Create Application"
7. SPARA tva saker:
   - **User Key** - visas overst pa din Pushover-dashboard (en lang bokstavskombination)
   - **API Token** - visas pa sidan for din nya applikation

---

## STEG 5: Skapa projektet

Oppna Terminal (Mac) eller Command Prompt (Windows).

Skriv dessa kommandon ETT I TAGET (tryck Enter efter varje):

```
npx create-next-app@latest oddstracker
```

Nar den fragar:
- Would you like to use TypeScript? -> **No**
- Would you like to use ESLint? -> **Yes**
- Would you like to use Tailwind CSS? -> **No**
- Would you like your code inside a `src/` directory? -> **No**
- Would you like to use App Router? -> **Yes**
- Would you like to use Turbopack? -> **No** (eller Yes, spelar ingen roll)
- Would you like to customize the import alias? -> **No**

Ga sedan in i mappen:
```
cd oddstracker
```

---

## STEG 6: Ersatt filerna

Nu ska du ersatta filerna som skapades med vara filer. Det finns TVA satt:

### Alt A: Kopiera fran nedladdade filer (enklast)

Du har laddat ner en ZIP/tar.gz med alla filer. Packa upp den och kopiera OVER
filerna till din oddstracker-mapp. Strukturen ska se ut sa har:

```
oddstracker/
  app/
    page.js          <- ERSATT med var fil
    layout.js         <- ERSATT med var fil
    api/
      cron/
        route.js      <- NY FIL (skapa mapparna)
      status/
        route.js      <- NY FIL
      test-push/
        route.js      <- NY FIL
  public/
    manifest.json     <- NY FIL
  vercel.json         <- NY FIL (i projektets rot)
  .env.example        <- NY FIL
```

### Alt B: Skapa filerna manuellt

Om du inte kan packa upp filen, oppna varje fil i en textredigerare
(t.ex. TextEdit pa Mac, Notepad pa Windows) och klistra in innehallet.
Alla filer finns i nedladdningen fran Claude.

VIKTIGT: Skapa mapparna api/cron, api/status, api/test-push INNE i app-mappen.

Pa Mac:
```
mkdir -p app/api/cron app/api/status app/api/test-push public
```

Pa Windows:
```
mkdir app\api\cron
mkdir app\api\status
mkdir app\api\test-push
mkdir public
```

---

## STEG 7: Testa lokalt

I terminalen, fran oddstracker-mappen:

```
npm run dev
```

Oppna webblasaren och ga till: http://localhost:3000

Du ska se OddsTracker-appen med demodata. Om du ser den ar allt korrekt.

Tryck Ctrl+C i terminalen for att stoppa.

---

## STEG 8: Pusha till GitHub

I terminalen:

```
git add .
git commit -m "oddstracker v3"
```

Ga till github.com i webblasaren:
1. Klicka "+" uppe till hoger -> "New repository"
2. Name: oddstracker
3. Lat allt annat vara som det ar
4. Klicka "Create repository"
5. Du ser en sida med instruktioner. Kopiera raden som borjar med:
   git remote add origin https://github.com/DITT-NAMN/oddstracker.git

Ga tillbaka till terminalen och skriv:

```
git remote add origin https://github.com/DITT-NAMN/oddstracker.git
git branch -M main
git push -u origin main
```

(Ersatt DITT-NAMN med ditt GitHub-anvandarnamn)

Det kan fraga om inloggning - logga in med ditt GitHub-konto.

---

## STEG 9: Deploya till Vercel

1. Ga till https://vercel.com
2. Klicka "Sign Up" och valj "Continue with GitHub"
3. Klicka "Add New..." -> "Project"
4. Du ser dina GitHub-repos. Klicka "Import" bredvid oddstracker
5. KLICKA INTE DEPLOY AN! Forst ska vi lagga till miljovariabler.

---

## STEG 10: Lagg till miljovariabler i Vercel

Pa samma sida (innan du klickar Deploy), expandera "Environment Variables".

Lagg till dessa EN I TAGET (skriv Name, sedan Value, klicka Add):

| Name | Value |
|------|-------|
| ODDS_API_KEY | din-api-nyckel-fran-the-odds-api |
| PUSHOVER_TOKEN | din-pushover-app-token-fran-steg-4 |
| PUSHOVER_USER | din-pushover-user-key-fran-steg-4 |
| CRON_SECRET | skriv-nagonting-hemligt-har-tex-abc123xyz |
| EV_THRESHOLD | 4 |
| MIN_ODDS | 1.8 |
| MAX_ODDS | 8 |
| MIN_ODDS_OU | 1.8 |
| OU_THRESHOLD | 55 |
| INPLAY_TRIGGER | true |
| INPLAY_MINUTE | 55 |
| INPLAY_SCORE_MAX | 0 |

Klicka sedan **Deploy**.

Vanta 1-2 minuter. Nar det star "Congratulations!" ar du live.

Du far en URL som: oddstracker-xxxx.vercel.app

---

## STEG 11: Testa att allt fungerar

Oppna dessa tre URL:er i webblasaren (ersatt med din URL):

### Test 1: Status
```
https://oddstracker-xxxx.vercel.app/api/status
```
Du ska se: oddsApiKey: "configured", pushover: "configured"

### Test 2: Push-notis
```
https://oddstracker-xxxx.vercel.app/api/test-push
```
Du ska fa en push-notis pa din iPhone inom 2 sekunder!

### Test 3: Kor scannern manuellt
```
https://oddstracker-xxxx.vercel.app/api/cron
```
Du ser JSON med alla hittade alerts. Om value bets finns far du push-notis.

---

## STEG 12: Satt upp automatisk scanning (VIKTIGT)

Vercel Hobby-plan har en begransning: cron-jobb kor max 1 gang/dag.
For att fa var 5:e minut, anvand cron-job.org (helt gratis):

1. Ga till https://cron-job.org
2. Skapa ett gratis konto
3. Klicka "Create Cron Job"
4. Fyll i:
   - **Title**: OddsTracker Scanner
   - **URL**: https://oddstracker-xxxx.vercel.app/api/cron
   - **Schedule**: Every 5 minutes
   - Under "Advanced" -> "Headers", lagg till:
     - Header name: Authorization
     - Header value: Bearer din-cron-secret-fran-steg-10
5. Klicka "Create"

NU KOR SYSTEMET AUTOMATISKT VAR 5:E MINUT, 24/7.

---

## STEG 13: Lagg till pa iPhone-hemskarm

1. Oppna Safari pa din iPhone
2. Ga till: https://oddstracker-xxxx.vercel.app
3. Tryck pa dela-knappen (fyrkant med pil upp, langst ner)
4. Scrolla ner och tryck "Lagg till pa hemskarm"
5. Tryck "Lagg till"

Nu har du en app-ikon pa hemskarmen. Men kom ihag:
du BEHOVER INTE ha appen oppen. Push-notiserna kommer via Pushover oavsett.

---

## Sammanfattning: Vad som hander nu

1. Var 5:e minut anropar cron-job.org din Vercel-server
2. Servern hamtar odds fran alla 10 ligor via The Odds API
3. Servern beraknar EV, kollar in-play triggers, kollar O/U-troesklar
4. Om nagonting triggas far du en push-notis pa iPhone via Pushover
5. Du kan ocksa oppna appen i webblasaren for att se hela dashboarden

Din dator kan vara avstangd.
Din telefon behover inte ha nagon flik oppen.
Du far notis automatiskt nar det ar dags att agera.

---

## Andra installningar

For att andra installningar (t.ex. EV-troeskel, minut-trigger):

1. Ga till vercel.com -> ditt projekt -> Settings -> Environment Variables
2. Andra variabeln du vill (t.ex. EV_THRESHOLD fran 4 till 3)
3. Ga till Deployments -> senaste deployen -> tre prickar -> Redeploy

---

## Kostnader

| Vad | Kostnad |
|-----|---------|
| Vercel Hobby | 0 kr/man |
| The Odds API Free | 0 kr/man (500 req = ca 4 dagars scanning) |
| The Odds API Starter | ~250 kr/man (20k req = full manad) |
| Pushover | ~50 kr (engangskostnad) |
| cron-job.org | 0 kr/man |
| **Total start** | **~50 kr engangskostnad** |
| **Total serios** | **~250 kr/man** |
