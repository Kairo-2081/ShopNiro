# Production Access and Secret Custody

## Current verified state (checked 2026-11-12)

- GitHub API reports **no protection rules** on the repository's `production` environment.
- This public repository cannot verify Render team membership, service permissions, or which secrets are configured in the host.
- Therefore the actual production access list, host-secret custody, and the requirement for two people to rotate secrets are **not verified**. Do not state that production is protected until these items are checked in the live dashboards.

## Required operator coverage

Two different people must be able to access the production API service, edit its environment, complete a secret rotation, and verify service health independently. Do not infer Render access from GitHub repository access.

Keep the names, work identities, Render workspace/service identifiers, API origins, and verification evidence in an **access-controlled internal operator inventory**, not in this public repository. Record at least:

- Primary operator and backup operator (different people)
- Each person's individual account and Render role
- Whether each person independently can edit production secrets and verify service health
- Reviewer, verification date, and any approved time-limited access exception

Use individual accounts and MFA, never shared logins. Review the complete Render roster and remove unknown or departed accounts. Do not publish personal contact details or infrastructure identifiers in this repository.

## Secret locations and rotation

- Store runtime secrets in the production Render service's **Environment** secret store. Never commit them, place them in build-time `VITE_*` variables, or share production `.env` files.
- Store a secret in GitHub Actions only when a workflow needs it, and scope it to the `production` GitHub Environment where possible. `CRON_SECRET` must match the API host and the cron workflow; `MIGRATE_DATABASE_URL` is workflow-only. Do not copy all Render secrets into GitHub.
- Keep an inventory of secret **names**, owners, issuing system, consumers, and last rotation date. Never record values in the inventory.
- Require a second operator to verify the secret name, target environment, resulting service health, and old-key revocation during rotation. Follow [Leaked secret or key](leaked-secret.md).

## Verification checklist

Complete this from the live service dashboards; repository membership alone is not evidence of Render access.

- [ ] Record the exact Render workspace, production API service name, and production API origin in the restricted internal operator inventory. Never record secret values.
- [ ] Review the Render team/member list and service-level permissions. Remove unknown or departed accounts and require individual accounts with MFA.
- [ ] Assign two different people to the primary and backup roles in the restricted inventory. Have each independently sign in and confirm they can edit the production service environment. Do not change a production value as part of this access check.
- [ ] Confirm runtime credentials are in the Render service's Environment store and inspect names only. Confirm GitHub contains only the workflow secrets it needs.
- [ ] Restrict the GitHub `production` environment to deployments from `main` and add a required reviewer. Verify the protection rules are active.
- [ ] Have an operator who did not write the payment switch follow [Gateway error practice drill](gateway-error-drill.md) against staging and record the wall-clock result.

## Required access controls

1. In GitHub Settings → Environments → `production`, restrict deployments to `main` and add a required reviewer. The environment had no protection rules when checked on 2026-11-12.
2. Review Render team members and service permissions; confirm exactly who can access production and that both designated operators can edit secrets. Store the verified roster in the restricted internal inventory.
3. Review both lists quarterly and after any departure or suspected account compromise. Record who reviewed and when.

**Release gate: NOT VERIFIED.** The private operator inventory has not been verified from Render, GitHub production deployment protection is absent, and the independent staging exercise is pending. Do not invent names or infer access from repository membership. Keep the roster and test evidence in the restricted inventory; update this public status only after verification.
