# nymwell

Domains from the terminal, for people and the agents that work for them (Claude Code, Codex, scripts).

```bash
npx nymwell lookup yourbrand --tlds all   # up to 500 names, free: DNS + public registry records
npx nymwell check yourbrand.com           # the registrar's answer and exact price
npx nymwell info example.com              # everything public about one domain
npx nymwell tlds                          # every ending, with prices
```

With an agent key from https://nymwell.com/app/agents/ in `NYMWELL_KEY`:

```bash
nymwell quote yourbrand.com --years 2
nymwell buy <quote_id>          # the saved card, within the workspace's agent limits; else a payment link
nymwell order <order_id>
nymwell domains
nymwell dns yourbrand.com
nymwell transfer-in yourbrand.com --auth-code <code>
```

`--json` prints the raw answer. `NYMWELL_ORIGIN` points at another server. No dependencies; Node 18+.
