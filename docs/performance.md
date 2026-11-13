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
read it for proportions, not absolute milliseconds.

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

## What the profile shows

One cold guest run with `npm run perf:profile` (HTTP/1.1, so read it for proportions): the first card at 2.8 to 3.4 s, and
the sampled self time was React's own code (`vendor-react`, 333 ms), the app's entry bundle (123 ms) and browser-native
work (350 ms, much of it Playwright polling for the card). The app's page components (`Storefront`, `OrbitGlobe`) added
less than 15 ms between them. The long frames sit inside React's click handler, the one that follows the tap on
"Explore Marketplace" (113 ms, 106 ms and 109 ms of script each, throttled). In other words there is no single slow
function left to fix: the cost is React committing the screen change in a few large steps on a slow processor.

## What is left

Most of the remaining time is the phone's processor: in a guest trace the products' data arrives by about 1.1 s but the
first card is not drawn until about 2.8 s, and React rendering of the landing and storefront trees dominates the main
thread in between. The next candidates are to render less of the landing page before the guest has asked for it, to split
the storefront's first render so the first row of cards paints before the rest, and to check the numbers on a real phone.
