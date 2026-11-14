# Drill and Verification Record

Some items cannot be closed by writing code or documents. They need a person with the right access to do a thing once and write down the result. This page is the template and the status list. **Every item below is open until a named person completes it.** Do not fill in a result you did not observe, and do not put names, work contacts, service identifiers or API origins in this public file: keep those in the restricted internal operator inventory and record only the outcome here.

## Status

| Item | Needs | Status |
| --- | --- | --- |
| Two people can each edit the production service environment and verify health | A Render team owner and two individual accounts with MFA | **Not verified** |
| A second person can rotate secrets (not the author) | The same two people, following [Leaked secret or key](leaked-secret.md) on staging | **Not verified** |
| Online payments switched off and back on, timed on Render | Someone who did not write the switch, on **staging**, with a stopwatch | **Not verified** |
| Staging deploy and rollback rehearsed end to end | The same independent person | **Not verified** |
| The age private key that opens backups is held by a named person and a restore has been rehearsed | The key holder, a new empty database | **Not verified** |
| A `production` branch exists, and the GitHub `production` Environment has a required reviewer and allows only that branch | A repository owner ([steps](../launch-checks/production-gates.md)) | **Not verified** |
| A runbook followed through by someone who did not write the code | Any operator | **Not verified** |

The launch-day checks (a real phone, a screen reader, the first live payment) are tracked separately in [Launch checks](../launch-checks/README.md).

## How to record a drill

Copy this block under the drill's heading in your internal incident log, or into a pull request description. A drill passes only if the person finished every step without asking the author for help.

```
Drill:            (for example: switch online payments off on staging)
Date and time:    
Environment:      staging  (never production for a drill)
Performed by:     (role only here; the name goes in the restricted inventory)
Wrote the code?:  yes / no   (an independent run needs "no")
Started at:       
Mitigation live:  (time `/api/payment/methods` showed cash on delivery only)
Restored at:      
Total time:       
Steps that were unclear or wrong:
Follow-up owner and date:
Result:           pass / fail
```

## What counts as done

- **Timing the switch:** the wall-clock time from opening the Render dashboard to the methods endpoint showing cash on delivery only, on staging, by someone other than the author. The only measurement recorded so far is a local in-process test (a few milliseconds), which excludes the dashboard, saving and a restart, so it says nothing about Render.
- **Rotation by a second person:** a staging secret rotated end to end by someone who is not the person who normally does it, following the runbook, with the old value revoked and health checked.
- **Rehearsal:** [Gateway error practice drill](gateway-error-drill.md) and [Deployment and rollback rehearsal](../deployment-rehearsal.md) completed on staging with the results recorded above.

After an item passes, change its status here with the date, and update the roadmap. Until then the public status stays "not verified".
