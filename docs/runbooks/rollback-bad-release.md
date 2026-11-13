# Roll Back a Bad Release

**Trigger:** After a deploy, checkout, sign-in or the storefront is broken, errors jump in the logs, or `/api/ready` fails on a build that was healthy before. The incident lead decides to roll back; the production operator performs it.

**What a rollback does and does not do.** It puts the previous application code back. It does **not** undo database migrations, which only ever move forward, and it does not roll back a separately deployed frontend. A release is only safely reversible if its migrations are compatible with the previous build, so check before you decide: if the bad release shipped a migration, the old code will run against the new schema.

1. Record the time, what broke, request IDs, and the current deploy ID. Decide whether a fix-forward (a small revert commit through the normal deploy) is faster and safer than a rollback. If customers are being charged or orders created wrongly, switch online payments off first with [Disable online payments; COD only](disable-online-payments.md) and decide on the rollback after.
2. Find the last known-good deploy in the Render service's deploy history. Copy its deploy ID, not a commit hash.
3. **Preferred path:** run the **Roll back Render service** workflow with the matching `target`, that deploy ID, and `confirm: ROLLBACK`. It checks that the Render service is the right one, that auto-deploy is off, and that the deploy exists, then redeploys it and checks `/api/ready` afterwards.
4. **Check the branch requirement before relying on it.** The workflow only runs when it is started from a branch with the same name as the target, and the Render service must track that branch. The repository has a `staging` branch but no `production` branch, so for `target: production` the workflow refuses to start until the production branch and the Render service's branch are set up to match. Settle this during the staging drill, not during an incident (see [Deployment and rollback rehearsal](../deployment-rehearsal.md)).
5. **Fallback if the workflow cannot run:** use Render's own rollback to a previous deploy from the service's deploy history in the dashboard. Do this only if you have permission to change the production service, then turn auto-deploy off so the next push does not undo it. This path is not rehearsed.
6. Verify: `/api/ready` returns `200`, the storefront loads a product, sign-in works, and one cash-on-delivery test order completes on staging or with an authorized test account. Check for orders or payments created during the bad window ([Payments failing](payments-failing.md), steps 4 and 6).
7. Open a fix-forward change that is tested before the next deploy. Do not redeploy the same commit.

**Close when:** The previous build is live and verified, affected customers and orders have an owner, and the failed commit is blocked from redeploying.

**Escalate** if the rolled-back code cannot run against the migrated schema, if the workflow reports a mismatch (wrong service, wrong branch, auto-deploy on), or if the production operator cannot be reached.

**Not verified:** a production rollback has never been performed or rehearsed. The independent staging drill in [Deployment and rollback rehearsal](../deployment-rehearsal.md) is pending.
