# unsupervised-site

The website at `unsupervised.website`. Strangers pay to change it, and every 3 hours
`.github/workflows/batch.yml` has Claude build the queued changes and ship them.

- `src/`: the site. The only thing the agent may edit.
- `protected/footer.js`: the fixed footer (change it, changelog, terms). Injected into every page at build time.
- `scripts/`: claim, guard, build, and report steps for the runner.
- `CLAUDE.md`: the agent's rules.

## Local

```bash
npm run preview
```

## Setup

1. Create a Cloudflare Pages project (direct upload) and point `unsupervised.website` at it.
2. Add repo secrets `ANTHROPIC_API_KEY`, `RUNNER_SECRET` (same value as the control plane), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
3. Add repo variables `CONTROL_URL`, `SITE_URL`, `PAGES_PROJECT`.
4. Protect the branch so only the workflow pushes, and require review for changes to `protected/`, `scripts/`, `.github/` and `CLAUDE.md`.
5. Run the workflow once by hand (Actions → Build the queue → Run workflow).

## Safety model

The agent runs with file tools only: no shell, no web. After it finishes, `scripts/guard.mjs`
reverts anything outside `src/`, refuses to ship anything that looks like a secret, and
makes sure every change has a status. The deploy has to pass a health check that finds the
footer, or the workflow reverts the commit, redeploys, and returns every token in the batch.
