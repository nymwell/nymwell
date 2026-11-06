# nymwell

Domains from the terminal, for people and the agents that work for them (Claude Code, Codex, scripts).

```bash
npx nymwell search yourbrand --tlds com,io  # live availability, price and buy link
npx nymwell suggest "quiet studio"           # available name ideas
npx nymwell lookup example.com              # public registration records
npx nymwell tlds                            # popular endings, prices and rules
npx nymwell status                          # search and checkout readiness
```

With an agent key from https://nymwell.com/app/agents/ in `NYMWELL_KEY`:

```bash
nymwell quote yourbrand.com --years 2
nymwell buy <quote_id>          # returns a secure checkout link
nymwell order <order_id>
nymwell domains
nymwell dns yourbrand.com
nymwell transfer yourbrand.com  # enter the transfer code only on the secure web page
```

`check` remains an alias for `search`, and `transfer-in` remains a safe alias for `transfer`. The CLI never accepts transfer codes or card details. `--json` prints the raw answer. `NYMWELL_ORIGIN` points at another server. No dependencies; Node 18+.
