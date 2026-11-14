# Real-device check (mid-range Android, mobile data)

Status: **not done.** Every performance number in [performance.md](../performance.md) is from a laptop with throttling. The
in-page timing that now gates the weekly run may be optimistic, and this check is how you find out. One phone is enough.

## What you need

- A mid-range Android phone (about 4 GB of memory, a 2020 or later mid-tier chip; not a flagship). Note the model.
- Mobile data on a normal connection, not office Wi-Fi. Note the network type and signal bars.
- The site to test: **staging** first (it has the same build), then production when it is live.
- A second device or the phone's own screen recorder (60 fps if the phone offers it).

## Guest run (the one that matters most)

Repeat **5 times**, writing each result down:

1. Close Chrome fully. Open Chrome, open **Settings, Privacy, Delete browsing data**, choose **All time**, tick **Cached
   images and files** and **Cookies and site data**, and delete. (This is the cold cache the budget assumes.)
2. Start the screen recording.
3. Type the site address and load it. Wait for the landing page.
4. Tap **Explore Marketplace** as soon as it appears.
5. Stop the recording the moment the **first product card** is fully drawn.
6. Open the recording and count from the first frame where the page starts loading to the frame where the card appears.
   Many gallery apps step through frames; at 60 fps, 60 frames is one second. Record the seconds, to one decimal.

Result: the median of the five and the slowest of the five. The budget is **3.0 s for both**, the same rule the lab uses.

## Returning customer (3 runs)

Sign in once, close the tab, reopen the site without clearing data, and time from load start to first product card the same
way. A returning customer lands on the storefront directly.

## What to compare against

The lab in-page numbers after the Brotli change were about 1.8 s (guest median) and 2.1 s (returning). If the phone is
**within about 0.5 s of them**, the lab method is a fair gate. If the phone is **more than 1 s slower**, the lab is too
kind: treat the click method (about 2.9 s, slowest 3.1 s) as the closer guide and keep working on speed before launch.

## Also check on the same phone, while you are there

- [ ] Text is readable without zooming; tap targets are not cramped.
- [ ] The orbit globe does not make scrolling janky.
- [ ] Rotating the phone does not break the layout.
- [ ] Bangla text shows with no missing glyphs (boxes).
- [ ] Checkout fits the screen with the keyboard open.

## Record

| Field | Value |
| --- | --- |
| Date | |
| Phone model and Android version | |
| Chrome version | |
| Network (type, bars) | |
| Guest: five times (s) | |
| Guest median / slowest (s) | |
| Returning: three times (s) | |
| Returning median / slowest (s) | |
| Within 3.0 s for both? | |
| Compared with lab (+/- s) | |
| Anything odd | |

Do not fill the table from the lab numbers. Leave a field empty if you did not measure it.
