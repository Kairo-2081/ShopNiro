# Production Access and Secret Custody

## Current verified state (2026-11-09)

- Production is documented as the existing Render API service; the production host team membership could not be inspected from this repository session.
- GitHub API reports **no protection rules** on the repository's `production` environment. The visible collaborator list contains `Kairo-2081` with repository admin permission; this is not proof of Render access.
- Therefore the actual production access list and the requirement for two people to rotate secrets are **not verified**. Do not state that production is protected until the rows below are filled from the Render team dashboard and the GitHub environment is protected.

## Required named operators

Fill names and work identities from the host account; do not infer them from GitHub repository access.

| Role | Human name | Work email / GitHub login | Render role confirmed | Can edit production secrets | Last verified |
|---|---|---|---|---|---|
| Primary production operator | **Required: enter name** | **Required** | **Required** | Yes | Not verified |
| Backup production operator | **Required: enter a different name** | **Required** | **Required** | Yes | Not verified |

Only these two named operators should have production secret-edit access unless a documented, time-limited exception is approved. Both must be able to rotate secrets without relying on the other being available. Remove departed users promptly; use individual accounts and MFA, never shared logins.

## Secret locations and rotation

- Store runtime secrets in the production Render service's **Environment** secret store. Never commit them, place them in build-time `VITE_*` variables, or share production `.env` files.
- Store a secret in GitHub Actions only when a workflow needs it, and scope it to the `production` GitHub Environment where possible. `CRON_SECRET` must match the API host and the cron workflow; `MIGRATE_DATABASE_URL` is workflow-only. Do not copy all Render secrets into GitHub.
- Keep an inventory of secret **names**, owners, issuing system, consumers, and last rotation date. Never record values in the inventory.
- Require a second operator to verify the secret name, target environment, resulting service health, and old-key revocation during rotation. Follow [Leaked secret or key](leaked-secret.md).

## Required access controls

1. In GitHub Settings → Environments → `production`, restrict deployments to `main` and add a named required reviewer. The current environment has no protection rules.
2. Review Render team members and service permissions; confirm exactly who can access production and that both named operators can edit secrets. Record the verified list above.
3. Review both lists quarterly and after any departure or suspected account compromise. Record who reviewed and when.

**Release gate:** This page remains incomplete until two different real people are named and verified in Render, and GitHub production deployment protection is configured. Do not invent names or assume repository collaborators have host access.
