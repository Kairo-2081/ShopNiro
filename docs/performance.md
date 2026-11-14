# Storefront performance

The budget: on a mid-range phone on mobile 4G, the first product card is on screen in under **3 seconds**, for a guest
who opens the site and taps "Explore Marketplace" and for a returning customer who lands on the storefront. Both the
median and the slowest run have to fit, so one lucky run cannot pass and one unlucky run cannot hide.

"Mid-range phone on mobile 4G" means Chromium emulating a Pixel 5 with 150 ms round-trip time, 1.6 Mbps down, 750 kbps
up and a processor four times slower than the machine running it, from a cold cache.

## Measure it

Use a production build over a seeded test database. The development server ships unbundled React and says nothing about
what a visitor downloads.

```sh
export DATABASE_URL=postgresql://shopniro_test:shopniro_test_password@127.0.0.1:5432/shopniro_perf_test
NODE_ENV=test npm run migrate
NODE_ENV=test npx tsx scripts/seed-test-database.mts

# The browser app calls the origin it was built with, so build for the HTTP/2 front the script starts.
VITE_API_URL=https://127.0.0.1:3443 NODE_ENV=production npm run build
# Start the server with NODE_ENV=production, APP_URL and CORS_ORIGINS set to https://127.0.0.1:3443, then:
npm run perf:storefront -- --url http://127.0.0.1:3200 --h2-port 3443 --runs 9
```

Two ways to time the tap. `--method click` (the default) is Playwright's `click()` and a wait for the card, so it includes
Playwright's own actionability checks, which run on the throttled main thread and cost a guest about 0.8 s that no visitor
pays. `--method in-page` stamps `performance.now()` marks from inside the page (button present, tap, card present) and
taps the moment the button exists, so it measures the page and not the harness. Report both; treat `click` as the upper
bound. **The budget gate uses `in-page`** (the weekly workflow's `gate_method` input defaults to it; pick `click` for a
stricter run). The reason is that `click` mostly measures the test tool's own overhead on the throttled processor. The
risk is that `in-page` is too optimistic, which is why `click` is still reported every week and why a check on a real
phone is still owed.

Why the HTTP/2 front: Render serves the site over HTTP/2, where twenty small requests share one connection. A plain Node
server speaks HTTP/1.1, where the browser queues requests beyond six connections, which makes a page look about 0.3 s
slower than it is in production. `--h2-port` puts a self-signed HTTP/2 server in front of the app, and gives every run its
own forwarded address so the API's per-address rate limit never turns a run into an error page.

The same measurement runs weekly and on demand as the **Storefront performance** workflow. It reports the numbers in the
job summary and fails only when "enforce" is set, because shared runners vary too much for a 3 s budget to gate every pull
request fairly.

## Find what is slow

```sh
npm run perf:profile -- --url http://127.0.0.1:3200
```

It prints the long animation frames (stretches over 50 ms where the page could not paint, with the scripts that ran in
them) and the CPU profiler's self time grouped by bundle file and function. Build with `VITE_API_URL` set to the same
origin you pass to the script, or the page will call the production API and never show a product.

The profile's own sampling slows the page, and Playwright's polling for the product shows up as native `check` time, so
read it for proportions, not absolute milliseconds. Pass `--h2-port 3443` to run it behind the same HTTP/2 front as the
measurement. Set `PERF_CHROMIUM_PATH` to use a Chromium build other than the one Playwright expects.

## Where it stands

Median / slowest of 9 runs, in seconds, production build behind an HTTP/2 front, on one laptop in one session. The
first row is from 7 runs and a different commit (the last one before the performance work).

| Build | Guest | Returning customer | Transferred |
| --- | --- | --- | --- |
| Before the performance work (`bfaabc8`) | 6.48 / 7.00 | 5.97 / 6.59 | 757 kB |
| `main` before this change (`43fd38f`), two runs | 3.36 / 3.80 and 3.36 / 3.84 | 3.10 / 3.78 and 3.08 / 3.32 | 243 kB |
| With this change, two runs | 2.97 / 3.76 and 3.29 / 3.45 | 2.68 / 3.06 and 2.70 / 3.15 | 238-241 kB |
| After rebasing on the latest `main` (`e5cc5d2`), 9 runs | 2.92 / 3.31 | 2.72 / 2.79 | 225 / 220 kB |

What that does and does not say:

- The earlier performance work (compressed responses, a 4.9 MB animation as WebP, a 352 kB logo as 19 kB, deferred
  count-ups, idle prefetching) took the page from about 6 s to about 3.3 s. That is the large, clear gain.
- This change makes a returning customer about **0.4 s faster** at the median, the same in both orders of a back-to-back
  comparison, because the landing page and its globe are no longer drawn before the storefront.
- The guest gain is **within run-to-run noise** (the two comparisons gave 0.4 s and 0.07 s at the median). The idle
  callback for the globe fires while the page waits for the network, so a guest who taps straight away still pays for it.
- On the last run (9 runs, one session) a returning customer is **inside the budget** at both the median (2.72 s) and the
  slowest run (2.79 s). A guest is not: the median is 2.92 s but the slowest run is 3.31 s, so the budget is still
  **not met** for guests. Earlier sessions gave the returning customer a slowest run of 3.06 s and 3.15 s, so one clean
  session does not prove it is safe. These are lab numbers on a laptop with throttling, not measurements of real visitors.

### Head start (this change), 15 runs each, Chromium 1248 behind the HTTP/2 front, same session

Median / slowest, in milliseconds.

| Build | Method | Guest | Returning customer | Transferred |
| --- | --- | --- | --- | --- |
| `main` (`e54a15f`) | click | 2802 / 3038 | 2473 / 2815 | 226 / 221 kB |
| `main` (`e54a15f`) | in-page | 2069 / 2451 | 2553 / 2700 | 224 / 221 kB |
| Head start | in-page | 1996 / 2091 | 2372 / 2493 | 224 / 221 kB |
| Head start + one shared `/api/auth/me` | in-page | 1886 / 2062 | 2273 / 2408 | 224 / 220 kB |
| Head start + one shared `/api/auth/me` | click | 2872 / 3112 | 2502 / 2673 | 226 / 220 kB |

What that says, and what it does not:

- By the in-page method, which times the page, both a guest and a returning customer are **inside the budget at the median
  and at the slowest run**, with about 0.9 s of headroom for a guest and 0.6 s for a returning customer.
- By the click method the guest is **still over** at the slowest run (3.11 s) and the median did not move (2.80 to
  2.87 s is noise). The click method's guest figure is dominated by Playwright's polling on the throttled thread, which the
  change cannot remove. If the budget is gated on `click`, it is not met for guests.
- Why the head start helps: a guest trace showed the entry code running by about 1.1 s but the public requests only
  starting at about 1.74 s, from an effect after the landing page rendered. They now start when the entry code runs, so
  the data is in by the time the guest taps. A tap after the data is in takes about 0.3 s to the first card, against about
  0.7 s for a tap that has to wait for it.
- The sign-in check used to be sent twice at once on every load, by the head start's request and by the page-validation
  effect. The two now share one request.
- All of it is a laptop with throttling, one session, not real visitors. Two runs from different sessions have differed
  by 0.1 to 0.4 s before, so treat gaps under that as noise.

## What the profile shows

One cold guest run with `npm run perf:profile` (HTTP/1.1, so read it for proportions): the first card at 2.8 to 3.4 s, and
the sampled self time was React's own code (`vendor-react`, 333 ms), the app's entry bundle (123 ms) and browser-native
work (350 ms, much of it Playwright polling for the card). The app's page components (`Storefront`, `OrbitGlobe`) added
less than 15 ms between them. The long frames sit inside React's click handler, the one that follows the tap on
"Explore Marketplace" (113 ms, 106 ms and 109 ms of script each, throttled). In other words there is no single slow
function left to fix: the cost is React committing the screen change in a few large steps on a slow processor.

### Brotli at build time and a transition on data arrival, 15 runs each, in-page, same session

Median / slowest, in milliseconds. `main` here is the merge of the head-start PR, built and measured in the same session
as the two changes, so the comparison is like for like (these are not the numbers in the table above, which are from an
earlier session).

| Build | Guest | Returning customer | Transferred |
| --- | --- | --- | --- |
| `main` | 1946 / 2181 | 2286 / 2644 | 224 / 220 kB |
| Brotli copies written at build time (quality 11) | 1834 / 2001 | 2117 / 2624 | 199 / 196 kB |
| Same, plus the catalogue update in a transition (dropped) | 2444 / 2910 | 2384 / 2813 | 199 / 196 kB |

- The server already answered Brotli browsers with Brotli, through the `compression` middleware, but at quality 4 on every
  request. Writing the copies once at build time at quality 11 makes the large chunks 14 to 16 percent smaller
  (`vendor-react` 69.8 kB to 59.8 kB) and costs no request-time CPU. The gain is about 0.1 to 0.17 s at the median and
  25 kB fewer bytes; the returning customer's slowest run did not move.
- Wrapping the catalogue update in `startTransition` made both scenarios slower by 0.4 to 0.6 s, because it also defers the
  render of the first card. It was reverted.
- Fewer entry bytes: the first load is now about 128 kB with Brotli (React 60, the app entry 26, the stylesheet 19, the
  English dictionary 16, icons 7). Every heavy screen is already lazy. The one large piece left is the English dictionary
  (52 kB raw), which would need splitting by screen, a bigger and riskier change that was not made.
- The build-time check counts first-load JavaScript and CSS at **149 of 150 kB gzipped**, so the next feature that adds to
  the entry will fail the build. That is a limit on `main`, not a result of this change. **The 150 kB limit stays.** A
  change that trips it has to justify its bytes or cut an equal amount (the English dictionary split is the obvious
  candidate); raise the limit only on purpose, accepting a slower first page.

## What is left

Most of the remaining time is the phone's processor: React's own code is about 400 ms of self time and the app's entry
bundle about 125 ms, and a 289 ms long frame lands when the data arrives on the landing page. Tried and not done: the
54 kB logo already loads at low priority after the first card, so it does not sit on the path; the transition above made
it worse. The next candidates are to render less of the landing page before the guest has asked for it, to split the
storefront's first render so the first row of cards paints before the rest (not as a transition: see above), to split the
English dictionary by screen, and to check the numbers on a real phone.
