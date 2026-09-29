# ENGL 591 Homeworks

@AGENTS.md

## Claude Code specifics
- The workflow in AGENTS.md is also available as the `report-builder` skill (`.claude/skills/report-builder/`).
- Use the docx/pptx skills only for reading or inspecting files. Deliverables are always built by `node shared/bin/build.js <project>`.
- For visual QA, read every JPG that `shared/bin/render.sh` produces. For the independent fact-check (workflow step 7), use a general-purpose subagent given the paper text, the extracted report/slide text, `facts.md` and `shared/RULES.md`.
- Stop at the ⏸ gates in AGENTS.md §2 and wait for the user. Update `PLAN.md` (status + next step) at the end of every session.
- Commit only when the user asks. The repo is public, and project folders stay git-ignored until submitted.
