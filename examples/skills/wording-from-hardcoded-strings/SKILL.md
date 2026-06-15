---
name: wording
description: Create i18n keys from hardcoded strings in <project> and sync them. Use when hardcoded UI strings appear, a feature needs translation keys, or the user runs /wording.
---

# /wording — <project>

Turn hardcoded strings into i18n keys and sync them to the source spreadsheet.

For sync-wording commands, configuration and exit codes, read
`node_modules/@betomorrow/sync-wording/skills/sync-wording/SKILL.md`. This skill
adds the project context and the key-creation workflow only.

## Project context

- **Languages (column order):** <fr (B), en (C), …> — values for `--add` must be
  given in this exact order.
- **Config:** `<wording_config.json>` — <target(s) and output paths>
- **Format:** <flat-json>
- **Usage in code:** `<t("my.key")>` (import: `<…>`)
- **Key naming convention:** `<feature.screen.element.property>` — examples:
  `<auth.login.title>`, `<journey.search.button.label>`

## Workflow

1. **Analyze** — find hardcoded user-facing strings in the given files (JSX text,
   `title=`/`label=`/`placeholder=` props, error messages). Check the
   <reference-language> file for an existing key that already covers the need
   before creating a new one.
2. **Propose** — for each new string, a convention-following key + translations in
   all languages (reference language first). Show a table and **ask for
   confirmation** before writing anything.
3. **Write locally** — insert the keys into the per-language files, keeping them
   sorted.
4. **Refactor** — replace the hardcoded strings with `<t("…")>`; add the
   import/hook if missing.
5. **Verify** — `<your type-check or build command>` confirms the new keys
   resolve. This needs only the local files, not the sheet. Proceed only when green.
6. **Sync** — the sheet write is the only irreversible, shared step, so do it last:
   ```bash
   npx sync-wording <--target X> --add "<key>" <one value per language, in column order>
   ```
   Several keys can go in one command (repeat `key + values`). If it exits with
   code 3, run `npx sync-wording auth` once (browser, interactive).

## Edit / remove existing keys

`--set` updates a key in place; `--remove` deletes its row (confirm first). See
the packaged skill for exact semantics.
