# Magpie Constitution

## Core Principles

### I. Simple, Low-Effort UX

The app MUST let a user finish a migration with as few screens, transitions, and taps as possible.

- Option sets of 5 or fewer items MUST use inline choices (segmented control, chips, or radio list).
- Option sets of more than 5 items MUST use a combo box (dropdown, searchable when the list can grow). Exception, approved by the project owner: the platform picker is a grid of cards in two sections (Automatic and Guided), because users need to see how each platform works before choosing it. Each card MUST show the logo, the name, and a one-line label.
- Every new screen MUST be justified in the plan. Prefer showing the next step in place on the same
  screen over navigating to a new one.
- Confirmation dialogs MUST only appear for destructive or irreversible actions.
- Every category and action button MUST show an icon. Add a short text label unless the icon alone
  is obvious and easy to understand (for example, close or back). If unsure, ask the project owner.
- All user-facing text MUST use simple, everyday words, as if talking to a child: short sentences,
  one idea per sentence, no technical terms (for example, say "Sign in" not "Authenticate", and
  "Daily limit reached" not "Quota exceeded").
- Every interactive element MUST have an accessibility label.

Rationale: the app does one job. Fewer screens and plain words make that job fast and hard to get
wrong.

### II. Relevant Tests for Every Change

Every feature and every bug fix MUST include tests that cover its behavior.

- Unit and component tests use Jest with the `jest-expo` preset and React Native Testing Library.
- Business logic (subscription export, diffing, batching, resume after failure, quota handling) MUST
  have unit tests.
- User flows changed by a feature MUST have component tests that check what the user sees and taps.
- Every bug fix MUST add a test that fails without the fix.
- Every test MUST check behavior that matters to the user or the business logic. Tests written only to raise coverage, or tests that only check that mocks were called, MUST NOT be added, and a reviewer MAY reject them.
- Tests MUST NOT call real platform APIs or use real accounts. Mock network and auth at the boundary.
- All tests MUST pass before a change is merged.

Rationale: tests are the proof that a feature works and stays working. Relevance matters more than a
coverage number.

### III. Security Baseline (NON-NEGOTIABLE)

Every feature MUST comply with this baseline. A plan or change that breaks a rule MUST NOT be merged
until the rule is met or the constitution is amended.

1. **Least privilege scopes**: for each platform, request only the minimum scopes it needs: read-only scopes for the source account and write scopes only for the target account. The spec MUST list the scopes per platform. For Google, request `https://www.googleapis.com/auth/youtube.readonly` for the source account and `https://www.googleapis.com/auth/youtube` only for the target account. Request no other scopes.
2. **Secure sign-in**: for each platform, use the most secure sign-in flow that platform offers to a public client (an app that cannot keep a secret), in this order of preference: the platform's native sign-in SDK, OAuth 2.0 Authorization Code with PKCE, then OAuth 2.0 Device Authorization Grant (device code flow). Sign-in MUST happen in the native SDK or the system browser, never in an embedded WebView. Never collect platform passwords. Validate every value the flow returns (for example the OAuth `state` and redirect URI, or the device code response) before use. The spec or plan of each platform MUST name the flow it uses and why no higher one in the list is available.
3. **Token storage**: store tokens only in `expo-secure-store` (iOS Keychain, Android Keystore).
   Never store tokens in AsyncStorage, files, or app state that is persisted elsewhere. Revoke tokens
   and delete them on sign-out.
4. **No secrets in the app**: the app is a public OAuth client. Never ship client secrets, API keys
   with write access, or private credentials. Everything in `app.json`, `app.config.*`, and
   `EXPO_PUBLIC_*` variables is public. Never commit `.env` files with secrets.
5. **Network**: HTTPS only. Keep iOS App Transport Security on and Android cleartext traffic off. The app talks only to an allowlist of hosts: the OAuth and API hosts of each supported platform (for Google: `accounts.google.com`, `oauth2.googleapis.com`, `www.googleapis.com`), plus one static host for guide content (`guides.json` and images). The guide host is read-only: the app sends it no user data and no identifiers. Every host MUST be listed in the spec or plan of the feature that adds it. No own backend, analytics, ads, or crash-reporting SDKs without a constitution amendment.
6. **Data minimization**: keep only the data the migration needs (account IDs, names, thumbnails, progress). User data never leaves the device except to the APIs of the platforms being migrated between. User data exports (such as JSON or zip files from a platform) MUST be parsed on the device only and never uploaded. The user MUST be able to delete all local data from inside the app.
7. **Logging**: never log tokens, authorization codes, email addresses, usernames, follow lists, or export contents. Production builds MUST NOT include debug logging of API payloads.
8. **Untrusted input**: treat API responses and deep link parameters as untrusted. Validate their
   shape before use and handle only expected deep link routes.
9. **Device permissions**: request no device permissions unless a spec requires one and explains why.
10. **Backups**: set Android `allowBackup` to `false` so app data and tokens are not copied to cloud
    backups.
11. **Dependencies**: prefer Expo SDK modules. Add a third-party package only if it is maintained and
    widely used. Commit the lockfile. `npm audit` MUST report no high or critical issues before a
    release.
12. **Over-the-air updates**: if EAS Update is used, updates MUST be code-signed.

Rationale: the app holds access to two accounts on each platform. One leaked token or over-broad scope can harm the user, and failing a platform's OAuth verification blocks public release.

### IV. Consistent, Modular Code Structure

New features MUST fit the existing structure. They MUST NOT be bolted onto unrelated code.

- **One home per thing**: code is grouped by responsibility under `src/` (for example `auth/`, `api/`, `move/`, `store/`, `state/`, `ui/`, `theme/`, `reminders/`). New code MUST go in the folder that owns that responsibility. A new folder is allowed only when no existing one fits, and the plan MUST say why. Types, constants, and helpers live with the module that owns them. Catch-all files (`utils.ts`, `helpers.ts`, `misc.ts`) are not allowed.
- **One job per file**: each file has one clear purpose. When a file or function starts doing more than one job, split it.
- **Same way every time**: follow the patterns already in the codebase (file naming, state handling, error handling, user-facing text in `src/strings.ts`, theme tokens from `src/theme/`). A second way to do the same job (for example another state library, HTTP client, or styling approach) MUST NOT be added without a plan that justifies it and owner approval.
- **Extend, do not patch**: a separate capability SHOULD be a new function, component, or module, plugged in at a clear integration point (for example a step list, a settings section, or a route). Growing existing code is fine when the change belongs to that code's own job (for example a new field on a form that already edits that data). Existing code MUST NOT grow flags, boolean parameters, or `if (newFeature)` branches to carry a capability that is not its job. Bug fixes may edit existing code directly. Agents use their judgment; the plan explains the choice when it is not obvious.
- **Flat logic**: avoid deeply nested `if` statements (more than two levels). Use early returns, or a mapping or lookup table (for example an object keyed by status or step) when it fits the actual case. Prefer whichever is clearer for the situation; do not force a table onto a single simple condition.
- **Reuse first**: before writing code, search for an existing function that does the job and use it. When the same logic is needed in two or more places, extract it into one shared module and use it from both. Business logic MUST stay separate from UI and network code so it can be reused and unit tested on its own. Do not build abstractions for a single, hypothetical use.
- **Simplest solution first**: before writing code, check in this order and stop at the first step that works: (1) is it needed at all, (2) does code in the repo already do it, (3) does a TypeScript or JavaScript built-in do it, (4) does an Expo SDK module or a native platform feature do it, (5) does an installed dependency do it, (6) only then write the minimum new code. A deliberate shortcut with a known limit MUST carry a comment in the form `// ponytail: <limit>, <when and how to upgrade>`. Shortcuts without such a comment are not allowed.
- **Constitution wins over tool rules**: when the ruleset of an agent tool or plugin (for example ponytail) conflicts with this constitution, the constitution wins. For example, Principle II tests stay required, "one job per file" stays, and specs stay detailed as described in Specification Style.
- **Restructure instead of forcing it**: if a feature cannot fit without reshaping many existing modules, or needs new architecture (for example a navigation library or a backend), the plan MUST stop and propose a restructure or a new project setup to the project owner. An approved restructure is its own change, done and tested before the feature work starts. It MUST NOT be mixed into the feature.

Rationale: features will be added over time, often by AI agents. Clear homes, one pattern per job, and new modules instead of patches keep the codebase easy to read and keep each change small and safe to review.

### V. No UI Automation, Respect Platform Rules

The app MUST follow each platform's terms with no exceptions.

- The app MUST NOT script taps, drive a WebView bot, use an accessibility service, or scrape pages to follow or subscribe on a platform. This applies to every platform that has no official follow API or whose terms forbid automation.
- Platforms without an official follow API (for example Facebook, Instagram, Threads, TikTok, X, and Twitch) MUST use a guided manual flow: the app shows the list and opens each profile, and the user taps Follow. The app MUST NOT ask for or store the user's password for these platforms.
- A platform's automatic flow MUST use only that platform's official API, within its quota, rate limits, and terms.
- Platform logos MUST be official and unmodified, follow each brand's guidelines, and be used only to name the platform. They MUST NOT appear in the app icon or the app name.

Rationale: automation breaks platform terms and gets users' accounts banned. A guided flow is slower but safe, and it keeps the user in control.

## Platform & Technology Constraints

- Stack: Expo (React Native) with TypeScript in strict mode. Builds use EAS Build.
- Specs MUST cover both Android and iOS. Android ships first. Any platform-specific behavior MUST be
  called out in the spec.
- Data source: each supported platform's official API, or the user's own data export for guided flows. Designs MUST respect each platform's API quota and terms. For example, on YouTube `subscriptions.insert` costs 50 units against a shared daily project quota. Batch work, save progress, resume after interruption, and tell the user clearly when a limit is reached.
- Guide content (steps and screenshots) MAY be served from the static guide host so it can be fixed without an app release. The app MUST ship a default copy so guides work offline.

## Specification Style (Encouraged)

These are SHOULD guidelines, not gates. A spec without a diagram is not blocked in review. Describe behavior in detail and use diagrams and tables where they make a spec easier to read. Diagrams add to the text and do not replace it: every requirement MUST still be written in text. Android and iOS are both covered, so mark any platform-specific branch in a diagram or table. Do not name one platform in a guideline or example when the idea applies to all supported platforms.

Use Mermaid for diagrams. GitHub renders it natively in Markdown files, pull requests, and issues. Suggest another text-based syntax only if it also renders on GitHub without a build step.

| What to describe | Use | Notes |
| --- | --- | --- |
| Flow or branching logic | Mermaid `flowchart` | Label each edge with its condition, such as `quota left?` or `yes` and `no`. |
| Interaction between actors | Mermaid `sequenceDiagram` | Actors are the user, the app, the platform sign-in, and the platform API. |
| Anything with states and transitions (migration job, batch, sign-in session) | Mermaid `stateDiagram-v2` | A good fit for resumable progress and quota pauses. |
| Screens of a feature and how the user moves between them | Mermaid `flowchart` as a screen map | Show the path of the main task first. |
| Entities and how they relate | Mermaid `erDiagram` | See the data model rule below. |
| Mapping or lookup (for example status to label, error to message) | Markdown table | One row per input. |
| Rule that depends on more than one condition | Markdown decision table | One column per condition, one column for the outcome. |

- **Data model**: `spec.md` SHOULD show a conceptual `erDiagram` with entities and relations only (for example, an Account has many Subscriptions), with no field types, IDs, or storage details. The full fields, types, and constraints belong in `data-model.md`, which the plan creates.
- **Place diagrams next to the text they explain**, so a reader does not have to jump around the file.
- **Split a diagram when it becomes hard to read on GitHub.** There is no fixed size limit.
- **No real data in diagrams or tables**: no real emails, tokens, or account IDs.

Rationale: a spec is read by people who are new to the feature. A flow, a state machine, or a table shows the logic faster than paragraphs and exposes gaps early.

## Development Workflow & Quality Gates

- Features follow the Spec Kit flow: specify, clarify (optional), plan, tasks, implement.
- Every plan MUST include a Constitution Check that confirms compliance with Principles I to V.
- A change is ready to merge only when: tests pass, TypeScript and lint report no errors, the
  security baseline is met, and the reviews and proof below are done.
- Git, commit, and approval rules are defined in `AGENTS.md` and apply to all contributors and agents.

### Review by Blast Radius

Most code is written by AI agents, and the project owner does not read every line. Review depth depends on how much of the app a change can break.

| Tier | What it covers | Review |
| --- | --- | --- |
| Trunk | `src/auth/`, `src/api/`, `src/store/`, `src/state/`, `src/move/` (batching, quota, resume), `App.tsx`, `app.config.ts`, `eas.json`, and any change to tokens, scopes, or the host allowlist | Full review by agents, as described below |
| Leaf | An isolated UI component, `src/strings.ts`, theme tokens, guide content, or a new module behind a feature flag | Skim, if the change has proof and sits behind a flag |

- A change that is hard to undo (for example a scope change, a token storage format, or a migration of stored data) is always Trunk and MUST be approved by the project owner.
- **Agents review Trunk changes**: at least one fresh review agent MUST review every Trunk change for correctness and one for security. Each sees only the diff, this constitution, and the spec, never the author agent's conversation.
- **The owner approves the what, not the how**: for every Trunk change, the review agent MUST explain in plain words what changed, what can break, and how to undo it. The project owner approves or rejects from that summary.
- **Red flags are checked by machine**: an automated check (CI or a script) MUST flag a pull request for owner approval when its diff adds or changes an OAuth scope, adds a network host, touches token storage or uses `AsyncStorage` for tokens, adds a dependency, or changes `app.config.ts`, `eas.json`, or the Android manifest.
- **Trunk changes need behavior tests**: every Trunk change MUST add or update unit tests for the behavior it touches (for example batching, resume, quota handling, or revoking tokens on sign-out).
- **Trunk pull requests stay small**: one Trunk concern per pull request. A large Trunk diff MUST be split before review.
- **One human expert review before public release**: before the app is submitted for platform OAuth verification or public release, a human security expert MUST review sign-in and token handling once.

### Proof in Every Pull Request

Every pull request written by an agent MUST include proof, so a reviewer does not have to run the branch:

- the names of the tests added or changed, and what each one checks;
- the result of running tests, TypeScript, and lint locally;
- screenshots or a screen recording for any UI change, on both Android and iOS where behavior differs;
- a short risk note: the tier (Trunk or Leaf), how to undo the change, and the agent's confidence.

The pull request description MUST be shorter than the diff.

### Independent Review

- The agent that wrote a change MUST NOT be its only reviewer.
- A review agent MUST start with a fresh context: it sees only the diff, this constitution, and the spec.
- Review comments cover correctness, security, and spec compliance. Style, formatting, and types are checked by lint and TypeScript only, so reviewers MUST NOT leave style comments ("nits").

### Feature Flags

- The plan of a feature that changes an existing user flow MUST say how the new behavior is turned on and off with a local feature flag, and where the flag is checked. The flag is checked at one integration point, in line with "Extend, do not patch" in Principle IV.
- The plan MUST keep the new code apart from its integration point, so a review can answer: "if this code fails, does the current flow still work, and does turning off the flag stop it?"
- Flags are local (app config or code). Remote flag services are not allowed (see Principle III, Network).
- A flag MUST be removed after the feature is fully launched.

### Merge-Ready Is Not Launch-Ready

Merged code is not finished. Before a feature is released to users:

- Run one launch audit of the whole feature against its spec: performance, the security baseline, edge cases (for example daily limit reached, sign-in cancelled, or the app closed during a batch), plain-word UX (Principle I), and cleanup of code left behind by agents. Review every `ponytail:` comment in the feature and either fix it or accept it for this release, and record the choice in the audit.
- Release with a staged rollout: a small Google Play rollout percentage and TestFlight first. Watch the crash data built into Play Console and App Store Connect before going to 100%. No crash-reporting SDK is added (see Principle III, Network).
- If EAS Update channels are used for a gradual release, updates MUST be code-signed (see Principle III, Over-the-air updates).

## Governance

- This constitution overrides other project practices. Runtime guidance for agents lives in
  `AGENTS.md`.
- Amendments are made through a pull request that updates this file, explains the change, and bumps
  the version.
- Versioning: MAJOR for removing or redefining a principle, MINOR for adding a principle or section
  or materially expanding guidance, PATCH for wording fixes.
- Reviews of every spec, plan, and pull request MUST check compliance. Any exception MUST be written
  in the plan with its reason and approved by the project owner.
- A spec's status becomes `Implemented` only after its launch audit is done (see "Merge-Ready Is Not Launch-Ready"), not when its code is merged.

**Version**: 1.5.0 | **Ratified**: 2026-11-08 | **Last Amended**: 2026-11-14
