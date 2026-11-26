---
name: "release"
description: "Make a new Magpie release: bump the version, update the docs site, build and sign the Android APK locally, tag main, and publish the GitHub release. Use when the owner asks to prepare, cut, build, sign, or publish a release."
---

# Release Magpie

Builds are local only, on the owner's Mac. Never use EAS. Signing needs the owner to type the keystore password, so run the signing script in a terminal tab the owner can type into, not in a background shell.

## Steps

1. **Start from main.** `git switch main && git pull --ff-only`, then create `chore/release-<version>`. Pick the version: new platform or feature means a minor bump, fixes only means a patch bump.
2. **Check `.env`.** `EXPO_PUBLIC_SIMULATE_QUOTA_AFTER` must be empty. Report the result to the owner.
3. **Bump the version** in all four places:
   - `app.config.ts`: `version` and `android.versionCode` (increase by 1).
   - `package.json` and the two top `version` fields in `package-lock.json`.
   - `android/app/build.gradle`: `versionCode` and `versionName` (`android/` is not committed, so edit it locally).
4. **Update `docs/index.md`** (the public site at https://dodo-tech-hub.github.io/magpie/): the platform list, the limits links (one per page in `docs/limits/`), and the trademark line. The sideloading link points to `/releases/latest`, so it needs no change. Check that every link on the page returns 200.
5. **Check the code.** `npm run typecheck` and `npm test` must pass.
6. **Open the PR.** Commit (`chore(release): bump version to <version>`, `docs(index): ...`), push, and give the owner the `https://github.com/Dodo-Tech-Hub/magpie/pull/new/<branch>` link. `gh` on this machine cannot open PRs. Wait until the owner merges it.
7. **Build and sign.** From the repository root, in a terminal tab: `.agents/skills/release/sign-apk.sh <version>`. The script builds, checks the APK version, signs with the `io.github.dodotechhub.magpie` key, checks the certificate fingerprint, and prints the SHA-256 of `magpie-<version>.apk`. The keystore holds more than one key, so the alias matters. If the owner types a wrong password, run the script again.
8. **Tag and publish.** Pull main and confirm the merged commit holds the bump. Then:
   ```
   git tag -a v<version> -m "Magpie <version>" <merged commit> && git push origin v<version>
   gh release create v<version> android/app/build/outputs/apk/release/magpie-<version>.apk --title "Magpie <version>" --notes-file <notes> --latest --verify-tag
   ```
   Publish a full release, never a pre-release: `/releases/latest` skips pre-releases, and the docs link to it.
9. **Verify.** `/releases/latest` opens the new tag, the APK is attached, and the live docs page shows the changes.

## Release notes

Plain language, short. Use this shape:

```
New: <what users can do now>.

Fixes: <user-visible fixes, one clause each>.

This is an early test version. For YouTube, only accounts on the test list can sign in.

Limits: [YouTube](https://dodo-tech-hub.github.io/magpie/limits/youtube) · [GitHub](https://dodo-tech-hub.github.io/magpie/limits/github) · [Bluesky](https://dodo-tech-hub.github.io/magpie/limits/bluesky)

Signing certificate SHA-256: `16:5B:CF:BC:B1:A4:F1:4C:0A:A3:E2:A6:C0:78:CA:B4:19:B5:D2:2D:B5:E4:60:6E:EA:F5:06:D0:9A:71:CE:FF`

SHA-256 of magpie-<version>.apk: `<hash from the script>`
```

Build the New and Fixes lines from `git log --oneline v<previous>..HEAD --no-merges`, keeping only `feat` and `fix` commits that users can notice. Drop the YouTube test-list line once Google verification passes.
