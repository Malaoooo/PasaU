# Where these skills come from

Copied from each project's official GitHub repo on 2026-10-20. To update one, copy its folder again from the same place.

| Skill folder(s) | Source repo | Commit |
|---|---|---|
| ponytail, ponytail-review, ponytail-audit, ponytail-debt, ponytail-gain, ponytail-help | github.com/DietrichGebert/ponytail (`skills/`) | 09c434a |
| caveman, cavecrew, megacave, ultracave, caveman-compress, caveman-stats | github.com/JuliusBrussee/caveman (`plugins/caveman/skills/`) | bad48a0 |
| impeccable | github.com/pbakaus/impeccable (`.claude/skills/impeccable`) | dad8dbb |
| design-taste-frontend | github.com/Leonxlnx/taste-skill (`skills/taste-skill`) | 63aba5f |
| graphify | github.com/Graphify-Labs/graphify (`graphify/skill.md`) | b90b9df |
| playwright-cli | github.com/microsoft/playwright-cli (`skills/playwright-cli`) | b1a5903 |

Notes:
- ponytail and caveman are always on through the repo-root CLAUDE.md (their rule text copied from each repo). Their plugin hooks are not copied, so level switches like /ponytail lite last only for the conversation.
- graphify needs its Python tool (`graphifyy`); the skill installs it with uv on first run.
- playwright-cli needs `npm install -g @playwright/cli` before use.
