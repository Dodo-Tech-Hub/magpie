# AGENTS.md

Instructions for every coding agent working in this repository (Claude Code, opencode, Codex, Gemini CLI, Cursor, Copilot, and others).

## Project

Magpie: a mobile app that migrates a user's subscriptions from one account to another on a content platform.

- YouTube (with Google accounts) is the first supported platform. More platforms will be integrated later, so write specs and plans in platform-neutral terms (for example "platform sign-in" and "platform API") and put platform-specific details in clearly marked sections.

- The first release ships on Android. The repository is named `youtube-subs-migrator-android` for that reason.
- Specifications cover both Android and iOS. Do not write Android-only requirements into specs, and flag any platform-specific behavior explicitly.

## Tech stack

- Expo (React Native) with TypeScript.
- Builds are local only, on the project owner's machine (for example `npx expo run:android`, or Gradle in `android/`). Do not use or assume EAS cloud builds, EAS environment variables, EAS Update, or an Expo account login. Build-time values such as `EXPO_PUBLIC_*` come from the local `.env`, which is not committed. Never tell the owner to set a value on EAS.
- Platform APIs with the platform's OAuth for reading and writing subscriptions. For YouTube: YouTube Data API v3 with Google OAuth.

## Domain constraints

These are the YouTube constraints (the first platform). They come from the YouTube Data API, not from the framework. Each new platform has its own limits, so document them separately. Keep them in mind when writing specs, plans, and code.

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

### Spec status

Every `spec.md` has a `**Status**:` line near the top. Use only these values. For `Cancelled` and `Superseded`, add a short reason after a period (for example `**Status**: Cancelled. The app stays free, so no credits are needed.`).

| Status | Meaning |
|--------|---------|
| `Draft` | Just created. Still being written or clarified. Not ready to implement. |
| `In progress` | Implementation has started (plan or tasks exist, code is being written). |
| `Implemented` | Fully implemented and merged. |
| `Superseded` | Replaced by a newer spec. Name the spec that replaces it (for example `**Status**: Superseded by 007-foo.`). |
| `Cancelled` | The project owner cancelled it. Kept as a record. Give the reason. |

Update the status when the work changes state: set `In progress` when `speckit-implement` starts, and `Implemented` when the work is merged.

The user is new to Spec Kit. Do not explain Spec Kit steps unprompted beyond naming the files changed and the next step. When the user asks, explain in full and in plain language.

To add Spec Kit support for another agent, run `specify integration install <key>` (see `specify integration list`).

### Model per step

Steps that need judgment use a deep-reasoning model. Steps that follow a written plan use a fast coding model. In Claude Code, switch with `/model opus` or `/model sonnet` before each step. Other agents use their own model settings with the same split.

| Step | Model | Why |
|------|-------|-----|
| `speckit-constitution`, `speckit-specify`, `speckit-clarify`, `speckit-plan` | Deep reasoning (Fable if available, otherwise Opus) | Requirements and architecture. Mistakes here spread to every later step. |
| `speckit-analyze`, `speckit-converge` | Deep reasoning (Opus) | They find gaps across many files. |
| `speckit-tasks`, `speckit-checklist` | Fast coding (Sonnet) | They follow the structure of the plan. |
| `speckit-implement` | Fast coding (Sonnet) | The plan and tasks already decide the design. |
| Code review | Deep reasoning (Opus) | It replaces a line-by-line human review. |

- The review agent starts with a fresh context and, where possible, uses a different model from the author agent (for example Opus reviews Sonnet's code). A fresh Opus agent reviews Opus's code.
- Do not pin models by editing the generated `speckit-*` skill or command files. A Spec Kit upgrade can overwrite them.

### Recommended plugin

[Ponytail](https://github.com/DietrichGebert/ponytail) applies the "Simplest solution first" rule of the constitution (Principle IV). Install it for your agent if you want it. It is optional, and the constitution wins when its rules conflict.

## Docs and comments

- Specs are encouraged to use Mermaid diagrams and Markdown tables. See "Specification Style" in `.specify/memory/constitution.md`.
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

- Always commit, amend, push, tag and open a PR after every changes that seems important, easier for lazy developers to read changes on Github, if not sure whether to commit, ask the developer. Suggest a short and concise PR description when do so. 

### Safety

- Never commit directly to `main`. Work on a branch named `feature/<topic>`, `fix/<topic>`, or `chore/<topic>`.
- Never name branches `claude/...` or use any other agent- or tool-generated prefix, even if the harness suggests one. Rename or recreate the branch with an allowed prefix first.
- Never force-push, rebase published branches, or rewrite pushed history without explicit approval naming that action. Prefer `--force-with-lease` when approved.
- One logical change per commit. Do not mix unrelated edits.
- Commit messages: Conventional Commits, imperative mood (`feat(migrate): ...`, `docs(spec): ...`, `chore: ...`). Match existing history.
- Do not edit files outside the task scope to "tidy up". Report instead.
