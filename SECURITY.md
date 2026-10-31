# Security

## Reporting a vulnerability

Please don't open a public issue. Report it through https://nymwell.com/en/contact/ and say it is a security report. Include what you found, how to reproduce it, and what an attacker could do with it. We reply as soon as we can and tell you when it is fixed.

This covers the CLI and plugin in this repository and the hosted service at nymwell.com.

## Supported versions

Only the latest published version of the `nymwell` npm package and of the Claude Code plugin receive fixes.

## How releases are made

- The CLI has no runtime dependencies.
- Releases are published to npm from GitHub Actions with npm provenance, so each version on npm can be traced to the commit that built it. No npm token is stored anywhere.
- The plugin runs a pinned CLI version (`npx -y nymwell@<version>`), and only the read-only commands are allowed without asking.
