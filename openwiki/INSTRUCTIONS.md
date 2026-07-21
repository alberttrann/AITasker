# AITasker OpenWiki Instructions

This file is the user-authored brief for OpenWiki. Edit it to define how the
repository documentation should be organized and written. OpenWiki reads this
file during local runs and GitHub Actions runs, but should not overwrite it.

Keep `quickstart.md` as the wiki entry point. Generated documentation must stay
inside `openwiki/`.

## Purpose and audience

<!-- Describe who will use the wiki and what it should help them accomplish. -->

- Primary audience: TODO
- Main purpose: TODO
- Expected reader knowledge: TODO

## Documentation structure

<!--
Replace the example below with the exact folders and pages your team wants.
Remove unwanted entries and add your own. OpenWiki will use this as the target
information architecture.
-->

```text
openwiki/
|-- quickstart.md
|-- architecture/
|   `-- overview.md
|-- teams/
|   |-- team-one.md
|   `-- team-two.md
`-- operations/
    `-- runbook.md
```

Do not create pages or directories outside the structure above unless required
to document an important area that cannot fit an existing page. If that happens,
record the proposed page in the `Backlog` section of `quickstart.md` first.

## Ownership and organization rules

<!-- Define how subjects map to teams, domains, services, or other boundaries. -->

- TODO: Define the owner and scope of each page or section.
- TODO: Define where cross-team behavior belongs.
- TODO: Define which subjects must not be split across multiple pages.

## Required page template

<!-- Replace these headings with the format every generated page should follow. -->

Use the following headings when they apply:

1. Purpose
2. Ownership
3. Key workflows
4. Components and source locations
5. API and data contracts
6. Dependencies
7. Failure modes and operational notes
8. Tests
9. Change checklist

Do not add empty headings when a section is not relevant.

## Sources of truth

<!-- List sources in precedence order and explain how conflicts are resolved. -->

1. TODO: Current implementation source code
2. TODO: Database schemas and current enums
3. TODO: Current implementation plans
4. TODO: Legacy or background documentation

When sources conflict, follow the highest-priority source and clearly identify
stale documentation when useful.

## Required coverage

<!-- List workflows, domains, integrations, and operational knowledge to cover. -->

- TODO

## Exclusions

<!-- List content OpenWiki should ignore or avoid generating. -->

- Never read or document secrets, credentials, private keys, tokens, or actual
  `.env` values.
- Do not document generated build output, dependency directories, or caches.
- Do not produce exhaustive file inventories or copy large source-code blocks.
- TODO

## Writing style

<!-- Define your team's preferred voice, depth, terminology, and formatting. -->

- Use concise Markdown and stable relative links between wiki pages.
- Reference important repository paths inline.
- Explain why important rules and architecture exist, not only what exists.
- Keep each concept in one canonical page and link to it elsewhere.
- TODO

## Update policy

- Preserve accurate documentation during updates.
- Change only pages affected by relevant source or workflow changes.
- Remove obsolete claims and pages after migrating any still-useful content.
- Keep a concise `Backlog` section at the end of `quickstart.md` for deferred
  coverage.
- TODO
