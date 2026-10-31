# Nymwell

Domain tools for people and the AI agents that work for them: a command-line tool, a Claude Code plugin, and the address of the MCP server. [Nymwell](https://nymwell.com/) is a domain registration service; availability and prices come live from the registrar (Name.com).

This repository holds the client side only. The service itself is hosted at nymwell.com and is not in this repository.

## Claude Code

Install the plugin:

```bash
claude plugin marketplace add nymwell/nymwell
claude plugin install nymwell@nymwell
```

Then ask the way you normally would: *"Find me a short .com for a ceramics studio and show the first-year and renewal price for each."* The plugin adds one skill that runs the CLI below, so Claude checks names in your terminal without an account.

Without the plugin, Claude Code can run the CLI directly: ask it to use `npx nymwell`.

## The CLI

```bash
npx nymwell lookup yourbrand --tlds all   # up to 500 names: DNS and public registry records
npx nymwell check yourbrand.com           # the registrar's answer and price, with a buy link
npx nymwell info example.com              # everything public about one domain
npx nymwell tlds                          # every ending, with prices
```

With an agent key from https://nymwell.com/app/agents/ in `NYMWELL_KEY`, the CLI can also quote, buy, renew and transfer, follow orders and read DNS. See [cli/README.md](cli/README.md). No dependencies; Node 18 or later.

## MCP

For assistants that connect to MCP servers (Claude, ChatGPT, Cursor, Codex):

| Address | Sign-in | What it can do |
| --- | --- | --- |
| `https://nymwell.com/mcp` | None | Search and price names, look up public records; buying hands the person a payment link |
| `https://nymwell.com/mcp/account` | OAuth (Google) | Everything on your account: buy within your limits, renew, transfer, DNS |
| `https://nymwell.com/mcp/lookup` | None | Read-only lookup tools |

In Claude Code: `claude mcp add --transport http nymwell https://nymwell.com/mcp`. Setup for each assistant: https://nymwell.com/en/docs/mcp/

## How payment is bounded

An agent can pay only with the card the person saved in the Nymwell console, within limits the person sets (by default US$100 per order and US$500 per 30 days). Only a person can add a card or change the limits. Without a key, or past a limit, the agent gets a payment link to hand to the person. The agent never sees the card number.

## Security

Keep agent keys in environment variables, never in chat, files or commits. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
