# Render instance type (free plan)

Status: **a decision was made, and the risk is open.** Staging and production run on Render's free plan. The deploy workflow
used to refuse a free instance; the owner chose to allow it, so a free plan now deploys with a warning on every run. The
workflow still refuses a service whose plan it cannot read.

## What the free plan costs you

Each of these is a property of the free plan as Render describes it; check the current terms in the Render dashboard, since
plans change.

- **Sleeps when idle.** A free web service stops after about 15 minutes with no traffic and takes tens of seconds to wake. The
  uptime monitor on production pings it so it normally stays awake. A monitor outage, a deploy or a Render restart still
  gives a cold start.
- **Shared monthly hours.** Free instance hours are shared across the workspace (about 750 a month). One service kept awake
  all month is about 744 hours. Any time staging also runs, the total can pass the limit, and Render then **suspends free
  services until the next month, production included.** Check usage in the Render dashboard (Billing or Usage), and keep
  staging off between runs.
- **Small CPU and memory.** The speed numbers in [performance.md](../performance.md) come from a laptop talking to a fast local
  server. Server response time on a free instance has not been measured.
- **Payment callbacks.** The gateway calls the server after a payment. If the service is asleep or restarting, the callback
  can be slow or fail. The nightly reconciliation is the safety net; how the gateway retries has not been checked.

## What to do about it

- Before the first live payment ([first live payment](first-live-payment.md)), either move production to the cheapest paid
  instance, or accept the risks above on purpose and do the first live test with a deliberately cold service to see what
  the gateway does.
- Look at free instance hours each month while on the free plan.
- To require a paid plan again, restore the check in `.github/workflows/deploy-render.yml` that refuses `free`.

## Record

| Field | Value |
| --- | --- |
| Date decided | 15 Nov 2026 |
| Decided by | The owner |
| Plan for staging / production | free / free |
| Free instance hours used this month (read from Render) | |
| Cold-start time of production after an idle gap (measured) | |
| Moved to a paid instance on | |
