---
name: wording-audit
description: Manual i18n wording audit for <project>, run ONLY when the user explicitly invokes /wording-audit. Does not auto-activate. Finds unused keys, remaining hardcoded strings and missing translations.
---

# /wording-audit — <project>

Find wording problems. For sync-wording commands (e.g. `--set`/`--remove` to fix
them), read `node_modules/@betomorrow/sync-wording/skills/sync-wording/SKILL.md`.

**Trigger:** only on an explicit `/wording-audit` invocation. This skill must not
auto-activate during ordinary wording or coding tasks — auditing is a deliberate,
on-demand action.

## Project context

- Keys live in `<output paths>` (<format>), consumed via `<t("key")>`.
- Source code to scan: `<src/>`.
- Key naming convention: `<feature.screen.element>`.

## Checks

1. **Unused keys** — for each key in the <reference-language> file, grep `<src/>`
   for the key string. Also account for dynamic usage (`<t(`prefix.${x}`)>`) that
   builds keys at runtime. Report keys with no hit as **candidate** unused —
   never delete automatically; dynamic usage is easy to miss.
2. **Remaining hardcoded strings** — scan components for literal user-facing text
   not wrapped in `<t(...)>` (JSX text nodes, `title=`/`label=`/`placeholder=`
   props). Report with `file:line`.
3. **Missing translations** — keys present in the <reference-language> file but
   empty/absent in another language file.

## Output

A report grouped by check, with `file:line` and the offending key/string. Propose
fixes — create a key, remove an unused one (`--remove`), fill a missing
translation (`--set`) — but apply them only after the user confirms.
