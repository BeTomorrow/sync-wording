# Example project wording skills

`sync-wording`'s **packaged skill**
(`node_modules/@betomorrow/sync-wording/skills/sync-wording/SKILL.md`) teaches an
agent *how to operate the tool* — commands, configuration, exit codes, workflows.
It is generic, versioned with the library, and `sync-wording init` wires a lazy
pointer to it from your `AGENTS.md` / `CLAUDE.md`.

A **project skill** is the complement: it captures *how your project does
wording* — things the library cannot know:

- your languages and column order, output paths, format;
- your key-naming convention;
- your translation hook (`useI18n`, a `t()` function, an i18n service…);
- project workflows (e.g. "turn hardcoded strings into keys").

The two are orthogonal and both worthwhile.

## The golden rule: delegate, don't duplicate

An efficient project skill **does not repeat the tool's command reference** — it
points to the packaged skill for that and keeps only project knowledge. Why:

- the skill loads on **every** wording task, so keeping it small protects the
  agent's context window;
- duplicated command docs **drift** when the tool evolves (a skill that still says
  "editing keys is not supported" after `--set` shipped is worse than no skill).

`init` already scaffolds a minimal `.claude/skills/wording/SKILL.md` stub that
points to the packaged skill. These examples show how to enrich that stub.

## Examples

- **`wording-project-context/`** — the minimal useful skill: project context +
  delegation. Start here.
- **`wording-from-hardcoded-strings/`** — a richer workflow: detect hardcoded
  strings, propose keys, write locally, refactor, verify, then sync.
- **`audit-wording-usage/`** — find unused keys and remaining hardcoded strings.

The first two are two approaches to the same thing — your project's main wording
skill; pick one and name it `wording` in your project. The audit skill is
complementary (and triggers only on an explicit `/wording-audit`).

Copy one into `.claude/skills/<name>/SKILL.md`, replace every `<placeholder>` with
your project's values, and trim what you don't need. If a skill grows past ~100
lines, split reference material (e.g. key conventions) into a sibling file and
link to it.
