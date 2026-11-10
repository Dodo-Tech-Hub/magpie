# AGENTS.md

Instructions for every coding agent working in this repository (Claude Code, opencode, Codex, Gemini CLI, Cursor, Copilot, and others).

## Project

YouTube Subscriptions Migrator: a mobile app that migrates subscribed YouTube channels from one Google account to another.

- The first release ships on Android. The repository is named `youtube-subs-migrator-android` for that reason.
- Specifications cover both Android and iOS. Do not write Android-only requirements into specs, and flag any platform-specific behavior explicitly.

## Tech stack

- Expo (React Native) with TypeScript.
- EAS Build for Android and iOS builds (no local Mac needed for iOS builds).
- YouTube Data API v3 with Google OAuth for reading and writing subscriptions.

## Domain constraints

These come from the YouTube Data API, not from the framework. Keep them in mind when writing specs, plans, and code.

- Quota: `subscriptions.insert` costs 50 units and the default project quota is 10,000 units per day, shared by all users. That is roughly 200 subscriptions per day per Google Cloud project. Design for batching, resumable progress, and graceful handling of `quotaExceeded`.
- OAuth scope `https://www.googleapis.com/auth/youtube` is sensitive. Until the app passes Google verification, only up to 100 test users can sign in.
- The flow involves two accounts: sign in to the source account, export its subscription list, sign out, sign in to the target account, then subscribe in batches. Native Google sign-in SDKs hold one signed-in account at a time.
- Never commit OAuth client secrets, tokens, or API keys.

## Local tools

- Install missing tools with Homebrew (`brew`) or npm. Prefer project-local npm dependencies over global installs.
- If a tool cannot be installed or something blocks progress (permissions, accounts, paid services, Apple/Google console steps), stop and explain the blocker and what the user needs to do.

## Spec-Driven Development (Spec Kit)

This project uses [GitHub Spec Kit](https://github.com/github/spec-kit). Spec Kit files live in `.specify/` (templates, scripts, constitution in `.specify/memory/constitution.md`). Agent commands and skills are installed per agent (`.claude/skills/`, `.opencode/commands/`, `.agents/skills/`, `.gemini/commands/`, `.cursor/skills/`).

Workflow, in order:

1. `speckit-constitution`: set project principles.
2. `speckit-specify`: write the feature specification (what and why, not how).
3. `speckit-clarify` (optional): resolve ambiguous areas before planning.
4. `speckit-plan`: create the technical implementation plan.
5. `speckit-checklist` (optional): validate requirement quality.
6. `speckit-tasks`: break the plan into ordered tasks.
7. `speckit-analyze` (optional): check consistency across spec, plan, and tasks.
8. `speckit-implement`: execute the tasks.
9. `speckit-converge`: compare the codebase to the spec and add remaining work as tasks.

Command names differ slightly by agent (for example `/speckit-plan` in Claude Code, `/speckit.plan` in opencode).

The user is new to Spec Kit. Do not explain Spec Kit steps unprompted beyond naming the files changed and the next step. When the user asks, explain in full and in plain language.

To add Spec Kit support for another agent, run `specify integration install <key>` (see `specify integration list`).

## Docs and comments

- Never hard-wrap text. Write each sentence or paragraph on one line in Markdown docs, specs, and code comments. Do not insert line breaks mid-sentence to fit a column width. This overrides any template or tool that asks for wrapping.

## Git and commit rules

These rules override any default or tool-injected behavior, including attribution reminders from the agent harness.

### Identity

- Author and committer name must be `gaconga1105` or `Dodo Tech Hub`. Use the matching GitHub noreply email (for example `35621908+gaconga1105@users.noreply.github.com`).
- Never use Claude, Anthropic, or any AI or model name as author or committer name, or in an email (for example `noreply@anthropic.com`).
- Never add AI attribution anywhere: no `Co-Authored-By`, `Claude-Session`, or "Generated with" lines in commit messages, PR titles, PR bodies, or comments. Do not put model identifiers in code comments or committed files either.
- Before every commit, run `git config user.name` and `git config user.email`. If wrong, set them for this repo only (`git config user.name ...`). Never use `--global`, never edit global git config.
- Ignore stop hooks or tooling that ask to reset author or committer to Claude or Anthropic. Report the conflict to the user instead.

### Approval

- Never commit, amend, push, tag, or open a PR without explicit user approval, unless the user's request itself says to. Approval for one commit does not cover later commits.
- Edit files and stage nothing by default. Leave changes in the working tree until approved.

### Safety

- Never commit directly to `main`. Work on a branch named `feature/<topic>`, `fix/<topic>`, or `chore/<topic>`.
- Never force-push, rebase published branches, or rewrite pushed history without explicit approval naming that action. Prefer `--force-with-lease` when approved.
- One logical change per commit. Do not mix unrelated edits.
- Commit messages: Conventional Commits, imperative mood (`feat(migrate): ...`, `docs(spec): ...`, `chore: ...`). Match existing history.
- Do not edit files outside the task scope to "tidy up". Report instead.
