# Nymwell for Claude

Nymwell helps Claude find a domain for the project you are building, check whether an exact name can be registered, compare the first-term and renewal price, and inspect public registration, DNS, email and HTTPS records. The plugin connects Claude to Nymwell's public MCP server and also teaches Claude Code to use the pinned `nymwell` command-line tool as a fallback.

Use it when naming or launching an app, product, company or website; connecting a custom domain to a host; comparing domain endings; or checking who operates an existing domain and when it expires.

## What Claude can do

- Search many candidate names and common endings.
- Confirm availability and price with live registrar data.
- Show first-term and renewal prices together.
- Return a Nymwell purchase link for a person to review and pay.
- Read public registrar, RDAP, DNS, email and HTTPS records.

Public search and lookup need no Nymwell account. By default, the plugin cannot charge a card. A purchase link opens Nymwell, where the person signs in, reviews the exact price and pays. Account actions such as buying within a spending limit, renewing, transferring or changing DNS require a separate signed-in connection to `https://nymwell.com/mcp/account`.

## Privacy and safety

Domain queries are sent to Nymwell and its connected registrar to return availability and pricing. Do not put passwords, API secrets, transfer authorization codes or personal contact details in a domain-search field. Nymwell does not expose card numbers to Claude. Learn more in the [privacy notice](https://nymwell.com/en/trust/privacy/) and [agent guide](https://nymwell.com/en/docs/agents/).

## Support

Setup and examples: [Buy a domain from Claude Code](https://nymwell.com/en/guides/buy-a-domain-from-claude-code/)

Security reports: [SECURITY.md](https://github.com/nymwell/nymwell/blob/main/SECURITY.md)
