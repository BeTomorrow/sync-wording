---
name: sync-wording
description: Sync application wordings (i18n) from a Google Sheet to local translation files using the @betomorrow/sync-wording CLI. Use when asked to update, sync, pull, add or fix translations, wordings, or i18n keys.
---

# sync-wording

Sync app wordings from a Google Sheet to local i18n files. The Google Sheet
is the source of truth; generated files must never be edited by hand.

## When to use

- The user asks to update, sync, refresh, or pull translations/wordings
- The user asks to add or change a translation key
- A `wording_config.json` (or a file passed via `--config`) exists in the project

## Commands

```bash
npx sync-wording --upgrade            # download the sheet as xlsx, then generate all files
npx sync-wording --update             # regenerate files from the local xlsx (no download)
npx sync-wording --check              # validate config and report what would be written (writes nothing)
npx sync-wording --target <name> ...  # restrict any command to one target
npx sync-wording --add <key> <values...>   # append key + one value per language to the sheet
npx sync-wording --set <key> <values...>   # update an existing key in the sheet
npx sync-wording --remove <keys...>        # delete row(s) from the sheet by key — destructive
npx sync-wording --sheet-name <tab> ...    # pick a sheet tab for --add / --set / --remove

npx sync-wording auth                 # interactive Google login (stores a token, run once)
npx sync-wording init                 # scaffold config and agent wiring
```

Prefer `--check` before a real sync to validate the setup, and read the
`Summary:` block printed at the end of a sync to verify the result.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Invalid translations found (with `--invalid error`) |
| 2 | Configuration error (missing/invalid config, unknown target, missing sheet) |
| 3 | Authentication error — run `npx sync-wording auth` |
| 10 | Unexpected error |

## Configuration

Read `wording_config.json` at the project root — it is the live source of
truth, never assume its content. Two shapes exist:

**Flat (single target):**

```json
{
  "sheetId": "<Google Sheet id>",
  "sheetNames": ["Commons", "MyApp"],
  "format": "angular-json",
  "output_dir": "src/assets/i18n/",
  "languages": { "fr": { "column": "D" }, "en": { "column": "C" } }
}
```

**Multi-target (one document, several syncs — e.g. app strings, accessibility
keys, iOS permission messages):**

```json
{
  "sheetId": "<Google Sheet id>",
  "targets": {
    "app":           { "sheetNames": ["MyApp"], "format": "angular-json", "output_dir": "src/assets/i18n/", "languages": { "fr": { "column": "D" } } },
    "accessibility": { "sheetNames": ["Accessibility"], "format": "flat-json", "output_dir": "src/assets/a11y/", "languages": { "fr": { "column": "C" } } }
  }
}
```

Field semantics:

| Field | Level | Meaning |
|---|---|---|
| `sheetId` | document | Google Sheet id (from its URL). Required |
| `credentials` | document | path to a Google OAuth client file; embedded credentials by default |
| `wording_file` | document | local xlsx cache path, default `./wording.xlsx` |
| `sheetNames` | target | sheet tabs to read, merged in order — **on duplicate keys, the last sheet wins**. Default: all tabs |
| `sheetStartIndex` | target | first data row, default 2 (row 1 = headers) |
| `keyColumn` | target | column holding the keys, default `A` |
| `format` | target | `json` (nested), `flat-json`, or `angular-json` |
| `output_dir` | target | where files are written, one `<language>.json` per language |
| `languages.<name>.column` | target | sheet column for that language |
| `languages.<name>.output` | target | optional per-language output path override |
| `ignoreEmptyKeys` | target | skip keys with empty values, default false |
| `validation` | target | `{ "column": "E", "expected": "OK" }` — keys whose validation cell differs are reported invalid |

Document-level values act as defaults for all targets; a target can override
any of them. A flat config is equivalent to a single target named `default`.

**Discovery:** a project may use several Google Sheet documents — check
`package.json` scripts for `sync-wording --config <other-file>` invocations
before assuming `wording_config.json` is the only configuration.

## Workflows

**Routine sync** (most common request):
1. `npx sync-wording --upgrade`
2. Verify the `Summary:` block; report invalid keys to the user if any
3. Commit the regenerated files together with the updated `wording.xlsx`

**Add a key:** `npx sync-wording --add my.key "English value" "Valeur française"`
— one value per configured language, in the order they appear in the config.
With multiple targets, add `--target <name>`. Then run `--upgrade` to
regenerate local files.

**Remove a key:** `npx sync-wording --remove my.key` — deletes the whole row
from the spreadsheet. This is destructive and not recoverable from the tool:
confirm with the user before removing, and run `--upgrade` afterwards to
regenerate local files.

**Sheet tab selection for `--add`/`--set`/`--remove`:** `--add` writes to the
first `sheetNames` entry of the target unless `--sheet-name <tab>` picks
another; `--set` and `--remove` search the key in all the target's sheets
unless `--sheet-name` narrows it to one. If the targeted key exists in several
sheets, the command refuses to guess and asks for `--sheet-name` (duplicates
of other keys never block the operation). `--sheet-name` must belong to the
selected target — the tool rejects a tab from another target (exit 2),
because it would write translations with the wrong column mapping.

**Add a language:** add the entry under `languages` in the config (column from
the sheet), then `--update` or `--upgrade`.

**First setup:** `npx sync-wording init --sheet-id <id> --languages fr:D,en:C`,
then `npx sync-wording auth` (interactive — the user must do this step),
then `npx sync-wording --check`.

## Upgrading from 1.x

Run `npx sync-wording init` — non-destructive (keeps the config, wires the
skill, validates). Keep the flat config as-is; do not convert it to `targets`.
Auth is now explicit: exit 3 → run `npx sync-wording auth`. Full guide in the
project README.

While upgrading, check whether the project has several config files syncing
the **same** `sheetId` (grep the repo — package.json scripts, CI, Makefiles —
for `--config <file>`). If so, offer to consolidate them into one multi-target
config: the document is downloaded once and `--target` runs one or all. Only
with the user's confirmation, and you MUST replace every `--config <file>` call
with `--target <name>` and remove the merged files, or builds break. Configs on
different documents stay separate; a single flat config stays as-is.

## Troubleshooting

- **Exit 3 / authentication error**: a stored token is missing. Ask the user to
  run `npx sync-wording auth` — it opens a browser and cannot run unattended.
- **Exit 2 / sheet not found**: the tab names in `sheetNames` don't match the
  document; the error lists the available tabs.
- **Invalid translations reported**: cells in the validation column don't match
  the expected value. This is a content issue for the wording owner, not a bug.
