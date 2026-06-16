# Sync Wording

This tool lets you manage your app's wording from a simple Google Sheet. Create a sheet with one column for keys and one column per language, and the tool generates your local translation files. Your product owner can edit the application's wording directly in the sheet.

The Google Sheet is the **single source of truth**: the generated files are build output and should never be edited by hand — they are overwritten on every sync.

> **Already using 1.x?** 2.0 is a low-risk, backward-compatible upgrade — and you can do it with a single copy-paste prompt for your coding agent: see [🚀 Migrate in one prompt](#migrate-in-one-prompt).

## Quick Start

You can find a sample sheet [here](https://docs.google.com/spreadsheets/d/18Zf_XSU80j_I_VOp9Z4ShdOeUydR6Odyty-ExGBZaz4/edit?usp=sharing) but it's just a simple sheet with one column for keys and columns for languages like this

| Keys                 | English   | French |
| -------------------- | --------- | ------ |
| user.firstname_title | Firstname | Prénom |
| user.lastname_title  | Lastname  | Nom    |

## Integration to your project

- Install sync-wording as dev dependencies ` npm install @betomorrow/sync-wording --save-dev`
- Create wording config file named `wording_config.json` at project root location.

```json
{
  "sheetId": "18Zf_XSU80j_I_VOp9Z4ShdOeUydR6Odyty-ExGBZaz4",
  "output_dir": "src/assets/strings/",
  "languages": {
    "en": {
      "column": "B"
    },
    "fr": {
      "column": "C"
    }
  }
}
```

- Add scripts lines to invoke tools easily with npm in `package.json`

```json
{
  "scripts": {
    "upgrade-wording": "sync-wording --upgrade",
    "add-wording": "sync-wording --add",
    "set-wording":"sync-wording --set"
  }
}
```

- Authenticate once with `npx sync-wording auth` — it opens your browser to grant access on Google Sheet and stores a token locally
- Then run `npm run upgrade-wording`

It will update wording files : `${output_dir}/en.json` and `${output_dir}/fr.json`

> Sync commands are non-interactive by design (CI and AI-agent friendly): if no
> token is stored they fail with exit code 3 and a message pointing to
> `sync-wording auth`, instead of opening a browser.

You can also bootstrap everything with one command:

```bash
npx sync-wording init --sheet-id <id> --languages en:B,fr:C
```

## Wording validation

In your google sheet, you can add column indicate that it's a valid translation

| Keys                 | English   | French | Validation |
| -------------------- | --------- | ------ | ---------- |
| user.firstname_title | Firstname | Prénom | OK         |
| user.lastname_title  | Lastname  | Nom    | KO         |

Then update your configuration file like this

```json
{
  "sheetId": "18Zf_XSU80j_I_VOp9Z4ShdOeUydR6Odyty-ExGBZaz4",
  "output_dir": "src/assets/strings/",
  "validation": {
    "column": "D",
    "expected": "OK"
  },
  "languages": {
    "en": {
      "column": "B"
    },
    "fr": {
      "column": "C"
    }
  }
}
```

Now the tool will warn you when you update wording containing invalid translations

## Options

This tool supports the following options

- **`--config`** : Configuration path
- **`--target`** : Restrict the command to a single named target (see [Multiple targets](#multiple-targets))
- **`--upgrade`** : Download the sheet into a local xlsx cache, then regenerate the wording files. Commit the xlsx so wording stays pinned — unrelated changes on the sheet won't leak into a bugfix build
- **`--update`** : Regenerate the wording files from the local xlsx cache, without downloading (offline, no auth needed)
- **`--check`** : Validate the configuration and report what would be written (key counts, invalid translations, output paths) without writing anything
- **`--invalid`** : (error|warning) exit with error when invalid translations are found, or just warn (default: `warning`)
- **`--add`** : Add one or more wording lines to the remote Google Sheet. Each line is a key followed by one translation per configured language (same order as `languages` in config). To add multiple lines in a single command, repeat the pattern (key + translations).
- **`--set`** : Update one or more existing wording lines in the remote Google Sheet by key. Same argument format as `--add`. The key must already exist in the target sheet.
- **`--remove`** : Remove one or more wording lines from the remote Google Sheet by key. Deletes the whole row. Same key resolution as `--set`.
- **`--sheet-name`** : Sheet tab for `--add` / `--set` / `--remove`; must belong to the selected target. Default: `--add` uses the first entry in `sheetNames`, `--set` / `--remove` search all the target's sheets.
- **`--verbose`, `-v`** : Print the resolved configuration before running (useful to debug a config or a target selection)

And the following commands:

- **`auth`** : Interactive Google login (opens a browser, stores a token for later non-interactive runs)
- **`init`** : Scaffold `wording_config.json` and wire AI agent skill references (see [AI Agent Integration](#ai-agent-integration)). Config-shaping flags: `--sheet-id`, `--languages <fr:D,en:C>`, `--sheet-names`, `--format`, `--output-dir`, `--key-column`, `--target`. Run interactively (it prompts for anything missing) or pass the flags for a non-interactive scaffold. Agent-wiring flags: `--skip-agents`, `--write-agents`

### Exit codes

| Code | Meaning |
| ---- | ------- |
| 0    | Success |
| 1    | Invalid translations found (with `--invalid error`) |
| 2    | Configuration error (missing/invalid config, unknown target, missing sheet) |
| 3    | Authentication error — run `sync-wording auth` |
| 10   | Unexpected error |

### Add wording lines

Use `--add` to push new keys and translations directly to the Google Sheet. By default, the first sheet in `sheetNames` is used; pass `--sheet-name` to target a specific tab (it must belong to the selected target, otherwise the command fails to avoid writing with the wrong column mapping).

Single line (2 languages: fr, en — order matches `languages` in config):

```bash
sync-wording --add user.email_title "E-mail" "Email"
```

Target a specific sheet:

```bash
sync-wording --sheet-name MyApp --add user.email_title "E-mail" "Email"
```

Multiple lines at once — repeat `key + translations` for each language:

```bash
sync-wording --add \
  user.email_title "E-mail" "Email" \
  user.phone_title "Téléphone" "Phone" \
  user.address_title "Adresse" "Address"
```

Keys are written to `keyColumn` and each translation to its language `column` from the config (e.g. key in `A`, `en` in `C`, `fr` in `D`).

The number of values after each key must match the number of languages defined in `wording_config.json`. With 2 languages, each line requires 3 arguments (1 key + 2 translations).

### Update wording lines

Use `--set` to update translations for existing keys. The key is searched in all the target's sheets (`sheetNames`, or every tab of the document if not set); pass `--sheet-name` to narrow the search to a single tab.

Single line:

```bash
sync-wording --set user.email_title "Email address" "Adresse e-mail"
```

Multiple lines at once:

```bash
sync-wording --set \
  user.email_title "Email address" "Adresse e-mail" \
  user.phone_title "Phone number" "Numéro de téléphone"
```

If a key is not found, the command fails with an error listing the searched sheets. If the key being updated exists in **several** sheets, the command refuses to guess and asks for `--sheet-name` — but duplicates of *other* keys never block the update (duplicates across sheets are legal: the last sheet wins at sync time).

### Remove wording lines

Use `--remove` to delete rows from the sheet by key. Key resolution works exactly like `--set`: the key is searched in all the target's sheets, `--sheet-name` narrows the search, and an ambiguous key (present in several sheets) is refused.

```bash
sync-wording --remove user.email_title
sync-wording --remove user.email_title user.phone_title   # multiple keys at once
```

The whole row is deleted from the spreadsheet — this is not recoverable from the tool, so double-check the keys. Run `--upgrade` afterwards to regenerate the local files.

## Complete Configuration

```text
{
  "credentials": "credentials.json",      // Optional, json google api service credentials, default: use embedded credentials
  "wording_file": "wording.xlsx",         // Optional, local xlsx cache path, default: "./wording.xlsx"

  "sheetId": "THE SHEET ID",              // *Required*
  "sheetNames": ["commons", "app"],       // Optional, sheet tabs to read, default: use all sheets
  "sheetStartIndex": 2,                   // Optional, first data row index, default: 2 (row 1 = headers)
  "keyColumn": "A",                       // Optional, column holding the keys, default: "A"
  "format": "json",                       // Optional, output format (json|flat-json|angular-json), default: "json"
  "ignoreEmptyKeys": false,               // Optional, skip keys with empty values, default: false
  "validation": {                         // Optional, document-level validation rule
    "column": "E",
    "expected": "OK"
  },
  "output_dir": "src/assets/strings/",    // Where files are written, one <language>.json per language
  "languages": {
    "en": {
      "output": "src/assets/strings/default.json",  // Optional, default: "${output_dir}/${language_name}.json"
      "column": "B",
      "validation": {                     // Optional, per-language validation rule (overrides document-level)
        "column": "E",
        "expected": "OK"
      }
    },
    "fr": {
      "output": "src/assets/strings/fr.json",
      "column": "C"
    }
    // [...] Add more languages here
  }
}
```

> Note: `sheetNames`, `sheetStartIndex`, `keyColumn`, `format`, `output_dir`,
> `ignoreEmptyKeys` and `validation` are **target-level** fields. In a flat
> config they sit at the top level; with [multiple targets](#multiple-targets)
> they can be set per target, and document-level values act as defaults.

## Output formats

The `format` field controls how each `<language>.json` is generated. With keys
`user.firstname_title` / `home.title`:

**`json`** (default) — keys split on `.` into a nested object:

```json
{ "user": { "firstname_title": "Firstname" }, "home": { "title": "Home" } }
```

**`flat-json`** — keys kept flat, exactly as written in the sheet:

```json
{ "user.firstname_title": "Firstname", "home.title": "Home" }
```

**`angular-json`** — flat translations wrapped with the locale (Angular i18n):

```json
{ "locale": "en", "translations": { "user.firstname_title": "Firstname", "home.title": "Home" } }
```

## Multiple targets

A single Google Sheet document often serves several purposes: app strings,
accessibility keys, iOS permission messages... Instead of maintaining several
config files, declare named `targets` sharing the same document:

```json
{
  "sheetId": "THE SHEET ID",
  "languages": {
    "en": { "column": "B" },
    "fr": { "column": "C" }
  },
  "targets": {
    "app": {
      "sheetNames": ["Commons", "MyApp"],
      "format": "angular-json",
      "output_dir": "src/assets/i18n/"
    },
    "accessibility": {
      "sheetNames": ["Accessibility"],
      "format": "flat-json",
      "output_dir": "src/assets/a11y/"
    }
  }
}
```

- Document-level values (`languages`, `keyColumn`, `validation`, ...) act as defaults; each target can override them
- `sync-wording --upgrade` downloads the document **once** and syncs every target
- `sync-wording --upgrade --target app` syncs a single target
- A flat configuration (no `targets`) keeps working unchanged — it behaves as a single target named `default`
- `sync-wording init --target <name> --languages ... --sheet-names ...` adds a target to an existing config (and migrates a flat config automatically)
- `--config` remains available for the real multi-document case (two different Google Sheets)

## AI Agent Integration

The package ships a skill that teaches AI coding agents (Claude Code, Cursor,
Copilot, ...) how to operate this tool: commands, exit codes, configuration
semantics and workflows.

```bash
npx sync-wording init
```

wires everything up:

- adds a lazy pointer to `node_modules/@betomorrow/sync-wording/skills/sync-wording/SKILL.md` in the project's umbrella agent files. It **appends** to `AGENTS.md` (the cross-agent standard read by Codex, Cursor, Amp, Zed, ...) and `CLAUDE.md` (Claude Code) when they exist, plus `.github/copilot-instructions.md` when a `.github` folder is present. The skill is read on demand when a wording task comes up, so it never weighs on unrelated sessions
- never seeds a top-level agent file from scratch on its own: if no `AGENTS.md` exists, `init` asks before creating one (interactive) or prints the exact snippet to add (non-interactive). Force creation with `--write-agents`. `CLAUDE.md` is never created from scratch, since Claude Code also reads `AGENTS.md`
- validates the configuration (`--check`) so a broken setup surfaces right away instead of at the first sync

The skill instructs agents to read `wording_config.json` live, so it never
goes stale when your configuration changes. Use `--skip-agents` to opt out.

### Project-specific skills

The packaged skill covers *how to operate the tool*. To capture *how your project
does wording* (key conventions, the translation hook, "turn hardcoded strings into
keys" workflows), add a project skill alongside it — it should **point to** the
packaged skill rather than duplicate its commands, so it stays small and never
drifts. See [`examples/skills/`](examples/skills/) for ready-to-adapt templates.

## Upgrading from 1.x

2.0 is a low-risk upgrade — your config, stored token and existing commands all keep working (the one behavioral change is explicit auth, see below). The fastest path, especially through a coding agent:

### Migrate in one prompt

A pre-2.0 project has no pointer to the packaged skill yet, so hand your coding agent this prompt — it does the whole upgrade:

> Upgrade the `@betomorrow/sync-wording` dev dependency to the latest 2.x and run `npx sync-wording init`. Keep a single `wording_config.json` as-is — don't convert it to multiple targets just to modernize it. But if the project has several config files pointing at the same Google Sheet (check `package.json` scripts and CI for `--config`), propose consolidating them into one multi-target config — show me a diff, update every invocation site, and only proceed after I confirm. If a sync later fails with exit code 3, tell me to run `npx sync-wording auth`. After init, read the skill it wires (`node_modules/@betomorrow/sync-wording/skills/sync-wording/SKILL.md`) for the 2.x workflows. Finally, suggest (don't impose, ask me first) creating a project-specific wording skill by adapting a template from `node_modules/@betomorrow/sync-wording/examples/skills/` with this project's languages, paths, hook and key conventions — these are templates to refine, not skills to use as-is. This is a backward-compatible upgrade; for the full notes see the "Upgrading from 1.x" section of the package README.

Once `init` has wired the skill, future agent sessions discover it on their own.

Prefer to do it by hand? It is non-destructive:

```bash
npm install @betomorrow/sync-wording@latest --save-dev
npx sync-wording init   # keeps your config, wires the agent skill, validates, prints an upgrade notice
```

### What changes (and what doesn't)

- **Config** — the flat `wording_config.json` from 1.x is fully supported as-is (it behaves as a single `default` target). No conversion needed.
- **Token** — same `.google_access_token.json`; already-authenticated projects and CI keep working without re-auth.
- **Commands** — `--upgrade`, `--update`, `--add`, `--invalid`, `--verbose`, `--config` behave the same. `--add` now also accepts several keys in one call — as do the new `--set` and `--remove` (all three are multi-key).
- **Auth is now explicit** — the one behavioral change. 1.x opened a browser automatically on the first sync; 2.x sync commands are non-interactive and fail with **exit code 3** instead, pointing to `sync-wording auth`. Run `npx sync-wording auth` once (or pre-provision the token in CI).

## Note

This tool includes Google Project credentials for convenience, but you can set up your own project. Create a new project in [GCP Console](https://console.cloud.google.com), then enable **Drive API** and **Sheets API** in the _API library_, and create and download credentials.

The tool requests two OAuth scopes (least privilege): `drive.readonly` (to export the sheet as xlsx) and `spreadsheets` (to add/update/remove wording lines).

## Development

The current repository uses this Sheet: https://docs.google.com/spreadsheets/d/18Zf_XSU80j_I_VOp9Z4ShdOeUydR6Odyty-ExGBZaz4/edit#gid=0

Build and install locally

```bash
npm run build
npm run installPackage
```

Run

```bash
rm  .google_*
sync-wording --upgrade
```

Publish

```bash
npm login
npm publish
```
