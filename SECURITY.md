# Security policy

Major Mayhem is a static single-page game: no accounts, no server and no personal data. Saves and stats live only in the player's browser. The realistic risks are in the client: crafted duel links or share codes, saved data that breaks the page, and third-party scripts.

## Supported versions

Only the live site (https://nanox333.github.io/major-mayhem/, built from `main`) is supported.

## Reporting a vulnerability

Please report privately through GitHub's **[Report a vulnerability](https://github.com/nanox333/major-mayhem/security/advisories/new)** form (Security → Advisories). Don't open a public issue. Include steps to reproduce, such as a duel link or share code.

You should get a reply within a week. Fixes ship as soon as CI passes on `main`, and reporters are credited in the advisory unless they'd rather not be.

## What's checked automatically

- **CodeQL** scans the JavaScript/TypeScript on every push to `main`, on pull requests and weekly.
- **Dependabot** opens weekly pull requests for npm packages and GitHub Actions.
