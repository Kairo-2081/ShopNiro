# Production gates: reviewer, branch, and deploy trigger

Status: **not done.** These are repository and host settings. Nothing in code can set them, and the API this was prepared
with could not read or change the `production` environment, so the current state is unverified. Do the steps, then record
the result in [the status table](README.md).

## Why each one matters

- **Required reviewer on the `production` environment.** Without it, anyone who can run the deploy workflow can deploy to
  production without a second pair of eyes. The workflow already refuses stale backups and non-`production` branches, but
  neither of those is a person approving.
- **A `production` branch.** The deploy and rollback workflows only run from a branch named after their target, and they
  require a successful push-triggered CI run on that branch for the same commit. The repository has `staging` but no
  `production`, so a production deploy refuses to start today.

## 1. Merge this change first

`ci.yml` only ran on pushes to `main`, `master` and `staging`. This change adds `production`, so the first push to a new
`production` branch runs CI. If you create the branch before this is merged, the branch has no CI run and the deploy
preflight will reject it.

## 2. Create the branch from `main`

Create it at the commit you want to be your first production release, with no force. From a clone with push access:

```sh
git fetch origin
git push origin origin/main:refs/heads/production
```

Wait for the **CI** run on `production` to pass. Do not repoint the Render production service yet.

## 3. Require a reviewer (repository owner, in the browser)

1. GitHub, this repository, **Settings**, **Environments**, **production**.
2. Under **Deployment protection rules**, tick **Required reviewers** and add the person who is not the one starting the
   deploy. A repository with one human can add that person's own account, but then it is a confirmation step rather than
   a second opinion; say so honestly in the status table.
3. Tick **Prevent self-review** if you have a second reviewer. Leave it off with one human, or you will lock yourself out.
4. Under **Deployment branches and tags**, choose **Selected branches and tags** and add `production` only. (Earlier notes
   said `main`; the workflow requires the `production` branch, so that is the one to allow.)
5. Save.

Verify as the repository owner:

```sh
gh api repos/<owner>/<repo>/environments/production \
  --jq '{reviewers: [.protection_rules[]|select(.type=="required_reviewers")|.reviewers[].reviewer.login], branches: .deployment_branch_policy}'
```

Expect your reviewer(s) listed and `custom_branch_policies: true`. A result with no reviewers means it is not set.

## 4. Point the Render production service at the `production` branch

In the Render dashboard, open the production API service, **Settings**, **Branch**, and set it to `production`. The deploy
workflow reads this and refuses if it does not match. Changing it does not deploy by itself; the next deploy does. Do this
only when you intend to cut over, and follow [Deployment and rollback rehearsal](../deployment-rehearsal.md) on staging first.

## 5. Check the whole path on staging first

Run **Deploy Render service** with target `staging` from the `staging` branch and confirm the preflight passes. Then repeat
for `production` once, from the `production` branch, and confirm it **stops at the approval** and shows the reviewer
a pending request. If it deploys without asking, step 3 is not in effect.

## 6. Set `EXPECTED_DATABASE_REF` in both Environments (do this before any migration or deploy)

The migrate and deploy workflows now refuse to run unless the database in the Environment's `MIGRATE_DATABASE_URL` secret
belongs to the project named in a non-secret variable, `EXPECTED_DATABASE_REF`. Each Environment keeps its own secret under
the same name, so a wrong value in one of them would otherwise migrate another environment's database without any error.
The check fails closed: **until the variable is set, `Migrate database` and `Deploy Render service` stop at it.** Nothing is
changed when they stop.

For each of `staging` and `production`:

1. In Supabase, open that environment's project, **Project Settings, General**, and copy the **Reference ID**
   (about 20 lower-case letters and digits). It is not a secret.
2. In GitHub, **Settings, Environments, staging** (then again for **production**), **Environment variables, Add variable**:
   name `EXPECTED_DATABASE_REF`, value the Reference ID **of that environment's own project**.
3. Run **Migrate database** on staging in a read-only mode (`status`). The step *Confirm the database belongs to this
   environment* should pass. Then deliberately check the failure: put the other project's Reference ID in a scratch copy of
   the variable, run again, and confirm it stops with "does not belong", then put the correct value back.

The check reads the project reference from the database host (`db.<ref>.supabase.co`) or from the pooler user name
(`postgres.<ref>`). It never prints the connection string, the host or the password. It cannot prove the secret's password is
right, only that the secret points at the project you expect.

## Done when

- `production` exists, CI is green on it, and the environment lists a required reviewer and only the `production` branch.
- A production dispatch waited for approval.
- The Render service tracks `production`.
- `EXPECTED_DATABASE_REF` is set in both Environments and the guard has been seen to pass and to refuse.
