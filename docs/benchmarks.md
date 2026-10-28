# Payment benchmarks

`scripts/payment-bench.mts` measures payment init latency and checks that the idempotency guarantees hold under
concurrency. The SSLCommerz gateway is stubbed (default 120 ms per init call), so nothing reaches a real provider.

## Run it

You need a disposable local PostgreSQL database built with `npm run migrate` (the same setup as `npm test`):

```sh
export DATABASE_URL=postgresql://shopniro_test:shopniro_test_password@127.0.0.1:5432/shopniro_bench
npm run migrate

npm run bench:payments -- load          # p95 of POST /api/payment/init at 10/20/40/80 simultaneous checkouts
npm run bench:payments -- starve        # do new refunds get initiated behind a backlog of old submitted ones
TRIALS=200 npm run bench:payments -- init          # 5 identical init requests per order
TRIALS=200 npm run bench:payments -- refund        # 4 refund workers racing on one refund
TRIALS=200 npm run bench:payments -- dupvalidate   # 4 simultaneous confirmations of a duplicate payment
```

The script prints JSON and, if `BENCH_OUT` is set, also writes it to that file. It refuses to run against a
non-local `DATABASE_URL`, because it inserts test customers, orders, payments and refunds.

| Variable | Default | Meaning |
| --- | --- | --- |
| `TRIALS` | 100 | Trials for `init`, `refund`, `dupvalidate` |
| `REPS`, `SIZES` | 5, `10,20,40,80` | `load`: repetitions per size and checkout counts |
| `GATEWAY_MS` | 120 | Stubbed gateway latency |
| `REPO_ROOT` | this checkout | Benchmark another checkout |

## Compare two commits

Use a worktree for the older commit, link `node_modules`, and point `REPO_ROOT` at it. Apply the newer migrations
to the benchmark database first; the added columns are nullable, so older code ignores them.

```sh
git worktree add --detach ../shopniro-old 62e90e9
ln -s "$PWD/node_modules" ../shopniro-old/node_modules
REPO_ROOT="$PWD/../shopniro-old" npm run bench:payments -- load
npm run bench:payments -- load
```

## How to read the numbers

- Absolute latencies come from a local database and a stub gateway. Read them as a shape, not a production figure;
  a hosted database adds network time to every query.
- `load` also prints `modelConnectionHeldMs`, `ceil(N / 10) x GATEWAY_MS`: the latency you would expect if every init
  held one of the pool's 10 connections for the whole gateway call.
- For `init`, `refund` and `dupvalidate`, zero violations in `n` trials bounds the true failure rate below
  `1 - 0.05^(1/n)` at 95% confidence (`ruleOfThreeUpperBoundPct`), for the scenarios tested only.
