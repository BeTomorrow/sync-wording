---
name: wording-project-context
description: Project wording context for <project>. Use for any i18n/translation, wording or sync task. Pairs with the packaged sync-wording skill.
---

# /wording — <project>

For sync-wording commands, configuration semantics, exit codes and workflows,
read `node_modules/@betomorrow/sync-wording/skills/sync-wording/SKILL.md`.
This skill only adds <project>-specific context.

## Project context

- **Languages (Google Sheet column order):** <fr (B), en (C), …>
- **Config:** `<wording_config.json>` — <flat, or multi-target: list each target
  and its output, e.g. `app` → `src/assets/i18n/`, `accessibility` → `src/assets/a11y/`>
- **Format:** <json | flat-json | angular-json>
- **How translations are consumed in code:**
  ```ts
  <e.g. const { t } = useTranslation(); t("my.key")>
  ```
- **Key naming convention:** <e.g. feature.screen.element.property>

## Notes

- The Google Sheet is the source of truth; generated files are build output —
  never edit them by hand (a sync overwrites them).
- <Any post-sync step, files to commit together, validation column owner, etc.>
