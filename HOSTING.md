# Hosting, domain, analytics and error reporting

Everything that depends on where the game lives is in **`site.config.json`**:

| Field | What it does |
| --- | --- |
| `url` | The game's public address, ending in `/`. Used for link previews (`og:image` must be absolute), the canonical link, the sitemap and the result card footer. |
| `name`, `shortName`, `title`, `description`, `themeColor`, `accent` | Page title, preview text and home-screen app name/colors. |
| `analytics.provider` / `siteId` / `host` | Analytics, off while `provider` or `siteId` is empty. See below. |
| `sentryLoader` | Optional Sentry Loader Script URL for crash reports. |

Any field can be overridden at build time with environment variables, handy on Cloudflare Pages or Netlify:
`SITE_URL`, `ANALYTICS_PROVIDER`, `ANALYTICS_SITE_ID`, `ANALYTICS_HOST`, `SENTRY_LOADER`.

The build (`npm run build`) puts these next to `dist/index.html`: `og.png` (1200×630 link preview), `favicon.svg`,
`favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
`manifest.webmanifest`, `robots.txt` and `sitemap.xml`. The images are drawn by `scripts/build-social.mjs` from the
game's fonts (`assets-src/fonts/`, SIL Open Font License), a radar and player photos, and land in `public/`
(generated, git-ignored). After changing `url`, rebuild so the preview image shows the new address.

## 1. Pick a host

**The repo is going private.** GitHub Pages only serves private repos on a paid plan (GitHub Pro, Team or
Enterprise). On the free plan, pick one of these instead; both deploy private repos for free:

### Cloudflare Pages (recommended: free, fast, and it also sells domains at cost)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, and give Cloudflare's
   GitHub app access to `major-mayhem`.
2. Build command `npm run build`, output directory `dist`. Add the environment variable `NODE_VERSION` = `22`.
3. Deploy. You get `https://<project>.pages.dev`. Put that (or your domain, step 2) in `site.config.json` → `url`,
   or set `SITE_URL` in the project's environment variables.

### Netlify / Vercel

Same idea: import the repo, build command `npm run build`, publish directory `dist`, Node 22.

### Staying on GitHub Pages

Works as it is now: the `deploy` job in `.github/workflows/ci.yml` publishes `main` after every check passes, as long
as the repo is public or on a paid plan.

**If you move to Cloudflare Pages, Netlify or Vercel,** delete that `deploy` job (and the "Package the site" step
before it), or it will fail on every push to `main` once the repo is private. Those hosts build every push to
`main` themselves and don't wait for CI, so keep `main` protected (Settings → Branches → require the CI check)
to keep the "only deploy what passed" guarantee.

## 2. Custom domain

Buy the domain (Cloudflare Registrar, Namecheap, Porkbun, …). Then:

**On Cloudflare Pages:** project → **Custom domains** → **Set up a custom domain**. If the domain's DNS is on
Cloudflare, the records are added for you; otherwise add the `CNAME` it shows you (`www` → `<project>.pages.dev`).

**On GitHub Pages:**

1. Repo → Settings → Pages → **Custom domain** → enter it → Save. (With the Actions deploy used here, no `CNAME`
   file is needed.)
2. DNS at your registrar:
   - Root domain (`example.gg`): four `A` records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
     `185.199.111.153` (optionally `AAAA` → `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`,
     `2606:50c0:8003::153`).
   - `www`: `CNAME` → `nanox333.github.io`.
3. Once the certificate is issued, tick **Enforce HTTPS**.
4. Recommended: verify the domain under your GitHub account → Settings → Pages, so nobody else can claim it.

**Then, whichever host:** set `url` in `site.config.json` to `https://your-domain/`, commit, and let it deploy.
Check the preview with a link-preview tester, or by pasting the link into a Discord DM to yourself. Discord and
X cache previews, so a link you've already posted may keep the old one for a while.

## 3. Analytics (off until you set it)

The game sends nothing until `analytics.provider` and `analytics.siteId` are set. It never sends from local files,
`localhost`, or browsers that ask not to be tracked. All three providers are cookieless, so no cookie banner is
needed for analytics alone (ads are a different story).

| Provider | `provider` | `siteId` | Custom events | Cost |
| --- | --- | --- | --- | --- |
| [Umami](https://umami.is) | `umami` | Website ID (Settings → Websites) | Yes, show up under Events | Free hobby tier on Umami Cloud, or self-host (`host` = your Umami URL) |
| [Plausible](https://plausible.io) | `plausible` | The domain as added in Plausible | Yes: add each event name below as a **goal** to see it | Paid (free trial), or self-host (`host`) |
| [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) | `cloudflare` | Beacon token from the JS snippet | No, pageviews only | Free |

Umami is the best fit if you want the game events for free.

### Events

| Event | When | Properties |
| --- | --- | --- |
| `run_start` | First case opened in a run | `mode` (free/daily), `daily` (number) |
| `reroll` | A case reroll | `mode`, `daily`, `round` |
| `draft_done` | Fifth player drafted | `mode`, `daily` |
| `match_result` | Each finished match | `mode`, `daily`, `stage` (QUAL/QF/SF/F), `result` (win/loss), `score` |
| `run_finish` | Results screen reached | `mode`, `daily`, `placement` (QUAL/QF/SF/F/CHAMP), `reached` (0–4), `mvp`, `grade` (draft %) |
| `run_abandon` | New run started before the old one finished | `mode`, `phase`, `picks`, `matches` |
| `share` | Copy result / share image / save image | `method` (copy/share_image/save_image), `ok`, `mode`, `placement`, `daily`, `from` |
| `speed` | Match playback speed changed | `speed` (1/2/4) |
| `error` | Uncaught crash (at most 5 distinct per page load) | `message`, `where`, `at`, `stack` |

Useful numbers to watch: daily players (`run_start` with `mode=daily`), completion (`run_finish` ÷ `run_start`),
share rate (`share` ÷ `run_finish`), where people drop off (`run_abandon` by `phase`), and returning visitors.

The code is in `src/analytics.ts` (providers, `track`, `reportError`) and `src/ui/useTracking.ts` (which state
changes become events).

## 4. Crash reports

Crashes already go to your analytics provider as `error` events. For full stack traces and grouping, add
[Sentry](https://sentry.io) (free developer tier):

1. Create a project (platform: Browser JavaScript).
2. Project Settings → **Loader Script** → copy the script URL (`https://js.sentry-cdn.com/<key>.min.js`).
3. Put it in `site.config.json` → `sentryLoader`.

Nothing is added to the bundle; the loader is fetched only when this is set. Code that catches its own errors can
call `reportError(err, 'where')` from `src/analytics.ts` (an error screen, for example).
