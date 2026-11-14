# Launch checks

Five things move launch readiness more than any more code. Each needs a person to do something once and write down what
they saw. **Every row below is open until a named person completes it.** Do not fill in a result you did not observe, and
keep names and service identifiers in the restricted internal operator inventory, not in this public repository.

## Status

| # | Check | Needs | Procedure | Status |
| --- | --- | --- | --- | --- |
| 1 | `production` branch, required reviewer, and a gated production dispatch | A repository owner, 10 minutes, then the Render dashboard | [Production gates](production-gates.md) | **Not done** |
| 2 | Speed on a real mid-range Android phone over mobile data | One phone, mobile data, 30 minutes | [Real-device check](real-device-check.md) | **Not done** |
| 3 | Screen-reader pass of sign in, find a product, cart and checkout | One person with TalkBack, VoiceOver or NVDA, 30 minutes | [Screen-reader checklist](screen-reader-checklist.md) | **Not done** |
| 4 | One controlled live payment and its refund | The owner's decision, a second person, a card of their own | [First live payment](first-live-payment.md) | **Not done** |
| 5 | Render instance type: staging and production are on the free plan (allowed on purpose) | The owner reading free instance hours in Render, and a cold-start timing | [Render instance type](render-instance-type.md) | **Open risk** |

## Order

1. **Gates first.** They are quick and they protect everything after. The `production` branch needs the CI change in this
   folder's pull request to be merged before it is created.
2. **Real device and screen reader next.** They need no production access and can run on staging, in parallel.
3. **The live payment last.** It is the only step that moves real money, and it depends on the gates.

## Rules that stay in force

- Payments stay in sandbox until the owner decides to launch. Nothing here changes that.
- A check that was not done is recorded as not done. A lab number is not a phone number.
- The related open items (two operators, secret rotation, the timed payment switch, a restore rehearsal) live in the
  [drill and verification record](../runbooks/drill-record.md).
