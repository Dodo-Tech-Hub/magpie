# Feature Specification: Magpie Rebrand

**Feature Branch**: `feature/magpie-rebrand` (no new branch made; the owner decides where this work lands)

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Use the supplied icon for the app. Rename the app to "Magpie". Rename the package to remove the word "youtube" (ideas: transfersubs, transferfollow; ask for a suggestion). Also tell me anything else I should do about branding."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The app looks and reads like Magpie (Priority: P1)

A user installs the app and sees the name "Magpie" and the magpie icon on their home screen, in the app switcher, on the opening screen, and in reminder notifications. No place still says "Subs Migrator" or shows the old icon.

**Why this priority**: The name and icon are the first things a user, a store reviewer, and Google's sign-in review see. Everything else in this feature is invisible to users; this part is the brand.

**Independent Test**: Install a build on an Android phone and an iPhone. Check the home screen label and icon, the app switcher card, the opening screen, and a reminder notification. All show "Magpie" and the new icon.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** the user looks at the home screen, **Then** the label reads "Magpie" and the icon is the supplied magpie artwork, with nothing cut off.
2. **Given** an Android phone that uses round, square, or rounded-square icon shapes, **When** the user views the icon, **Then** the bird and the circle stay fully visible in every shape.
3. **Given** an Android phone with themed icons turned on, **When** the user views the icon, **Then** it shows as a single-color Magpie mark in the phone's theme color.
4. **Given** the app is opening, **When** the opening screen shows, **Then** it shows the Magpie mark on a background that matches the icon, with no white flash.
5. **Given** a daily-limit reminder is due, **When** the notification appears, **Then** its title reads "Magpie" and its small icon is the Magpie mark, not a blank square.
6. **Given** the supplied artwork has a small gray sparkle in its bottom-right corner, **When** the icon is prepared, **Then** that sparkle is not in any shipped icon.

---

### User Story 2 - No "YouTube" in the app's name or internal names (Priority: P1)

Internal names that stores and Google read (the project name, the app's store identifier on each platform, and the install link name) no longer contain "youtube" and match the new brand. A user never types these, but a store reviewer or a Google reviewer sees them, and "YouTube" in a name can block approval.

**Why this priority**: Google's rules do not allow third-party apps to use "YouTube" in their names. Changing identifiers is cheap now and impossible after the first store release, so it must happen before release.

**Independent Test**: Search the project's app settings, package details, and build settings for "youtube". The only matches left are the names of the YouTube service itself (the connection to YouTube and the permission names Google defines). Then build and sign in with two test accounts and move one channel.

**Acceptance Scenarios**:

1. **Given** the renamed project, **When** the owner checks the project name, the app's install link name, and the store identifiers on both platforms, **Then** none contains "youtube" and all use the same new name.
2. **Given** the new identifiers and updated Google sign-in credentials, **When** a tester signs in to the old and the new account on a real device, **Then** sign-in works and a channel can be moved as before.
3. **Given** a phone with an older test build installed under the old identifier, **When** the tester installs the new build, **Then** it installs as a separate app, and the old build and its saved data stay untouched until the tester removes them.
4. **Given** the rename is done, **When** the full test suite runs, **Then** all tests pass with no change to what they check.

---

### User Story 3 - Say clearly that Magpie is not YouTube (Priority: P2)

A user opens Settings and sees a short plain line: Magpie is not made by or linked with YouTube or Google, and YouTube is a trademark of Google LLC. It uses simple words and sits in the existing Settings view.

**Why this priority**: Apps that work with YouTube data are expected to avoid implying that YouTube or Google backs them. A short notice lowers the chance of a review rejection and of user confusion. It does not block the core brand change, so it comes second.

**Independent Test**: Open Settings and read the notice. Switch theme and confirm it stays readable in Light and Dark.

**Acceptance Scenarios**:

1. **Given** the user is on any step, **When** the user opens Settings, **Then** the notice is visible without extra taps or extra screens.
2. **Given** the notice is shown, **When** a screen reader reads it, **Then** it reads as plain text in full.
3. **Given** the theme is Light or Dark, **When** the user reads the notice, **Then** the text has enough contrast to read.

---

### Edge Cases

- A phone has an older test build installed. The new identifier makes the new build a separate app. Saved progress in the old build does not carry over. This is accepted because the app is not yet released.
- Google sign-in fails after the identifier change until the owner creates or updates the Google sign-in credentials for the new identifiers. The app keeps its existing friendly sign-in error message in that case.
- Thin lines and the small spark near the bird's beak may turn to noise at launcher size. The owner reviews the icon at 48 px and 29 px and may drop the spark from every size to keep the icons identical.
- "Magpie" is a common word. Another app or company may already use it in a store or as a trademark. The owner checks this before submitting to a store; the name still ships here.
- Android 13+ themed icons and iOS dark or tinted icon modes can recolor the icon. The artwork must still read as a bird in a single color.
- The opening screen shows before the app knows the chosen theme. It uses the icon's own background so it looks the same in Light and Dark.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app's display name MUST be "Magpie" on Android and iOS, in the home screen label, the app switcher, and every place the app names itself in text.
- **FR-002**: The reminder notification title MUST read "Magpie".
- **FR-003**: The app MUST use the supplied magpie artwork as its icon on Android (standard, round, and themed single-color versions) and on iOS.
- **FR-004**: The Android icon MUST keep the whole artwork inside the area that every icon shape shows, so nothing is cut off in circle, square, rounded-square, or squircle shapes.
- **FR-005**: The iOS icon MUST be a full square with no transparency and no pre-rounded corners.
- **FR-006**: The shipped icons MUST NOT contain the small gray sparkle that is in the corner of the supplied artwork, or any other mark that is not part of the logo.
- **FR-007**: The opening screen MUST show the Magpie mark on the icon's background color so there is no white flash before the first screen.
- **FR-008**: The reminder notification MUST show a single-color Magpie mark as its small icon where the platform needs one.
- **FR-009**: The project name, the app's install link name, and the store identifiers on Android and iOS MUST NOT contain "youtube". They MUST all use one new shared name.
- **FR-010**: The renamed identifiers MUST keep the same sign-in and move behavior: sign-in, listing, and following still work once the Google sign-in credentials match the new identifiers.
- **FR-011**: References to YouTube that name the service itself (the YouTube connection and Google's permission names) MUST stay unchanged.
- **FR-012**: Settings MUST show a short plain-language notice that Magpie is not affiliated with YouTube or Google, and that YouTube is a trademark of Google LLC.
- **FR-013**: The notice MUST follow the constitution: simple words, an accessibility label, Light and Dark theme support, and no new screen.
- **FR-014**: Project documents that name the product (the agent instructions and the specs that describe the app by name) MUST call it "Magpie". They keep "YouTube" only where it names the service.
- **FR-015**: Every existing test MUST still pass, and a test MUST check the new display name where the app shows its own name (the reminder title) and that the notice shows in Settings.

### Key Entities *(include if feature involves data)*

- **App Identity**: What users and stores see. It has the display name ("Magpie"), the icon set (standard, Android adaptive foreground and background, Android themed single-color, iOS, opening screen, notification mark), and the short notice text.
- **Project Identifiers**: Names users never see but stores and Google read. They are the project name, the install link name, the Android package name, and the iOS bundle name. All share one new name.
- **Google Sign-In Credentials**: The public client IDs tied to the Android package and the iOS bundle name in the owner's Google Cloud project. They must be created or updated for the new identifiers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every place the app names itself (home screen, app switcher, opening screen, notification title, Settings), 100% show "Magpie" and 0 show "Subs Migrator" or "YouTube" as the app's name.
- **SC-002**: In a review of the icon in 4 mask shapes (circle, square, rounded square, squircle), plus themed and non-themed views, 0 icon parts are cut off and 0 stray marks appear.
- **SC-003**: At 48 px and 29 px, the owner can tell the icon is a bird in a circle without being told.
- **SC-004**: A search of the project's app settings, package details, and build settings finds 0 uses of "youtube" as a project, package, or app identifier.
- **SC-005**: A tester with two test accounts completes a full migration of at least one channel on a real Android phone and a real iPhone after the rename, with the same result as before.
- **SC-006**: The not-affiliated notice is reachable in 1 tap from any step and is readable in both Light and Dark.
- **SC-007**: 100% of existing tests pass after the change, and every new behavior above has a test.

## Assumptions

- The app has not been published to any store, and no real users have it. A new identifier is cheap now. If it was published, the new identifier makes it a different app and this spec must be revisited.
- **Suggested shared name: `magpie`.** It matches the brand, so the display name, project name, install link, and store identifiers all say the same thing. Result: project name `magpie`, install link `magpie`, Android package and iOS bundle `com.dodotechhub.magpie`. This replaces `com.dodotechhub.subsmigrator`, which has no "youtube" but would no longer match the brand.
- `transfersubs` and `transferfollow` were considered and not chosen. They describe the job, not the brand, so the name would change again if the app grows beyond moving subscriptions. "Follow" is also not a YouTube word (YouTube says "subscribe"), which would confuse the code. If the owner wants a descriptive name anyway, `transfersubs` is the better of the two.
- The GitHub repository should be renamed to `magpie` too. This is a one-time owner action on GitHub, outside the app. It drops both "youtube" and "-android", since the specs cover Android and iOS.
- The owner will create or update the Google sign-in credentials for the new Android package (with the signing fingerprint) and the new iOS bundle, and will update the sign-in consent screen so its app name is "Magpie". Until then, sign-in will not work on the new identifiers.
- The supplied artwork is a 1024 x 1024 square with an off-white line drawing of a magpie in a circle on a near-black background. The app uses it as is, apart from removing the sparkle and producing the sizes each platform needs. Redrawing the logo is out of scope.
- The owner confirms they have the right to use the artwork commercially. If a tool made it, its terms and the ability to claim rights in it vary, so the owner checks before a store release.
- The notice wording is simple: for example, "Magpie is not made by or linked with YouTube or Google. YouTube is a trademark of Google LLC." The exact words are set in planning.
- Out of scope here, and best done by the owner or in later specs. This is the rest of the branding list:
  - Check "Magpie" for store-name and trademark conflicts before submitting.
  - Write a privacy policy and host it at a public link. Google's sign-in review and both stores ask for one. The policy should say that the app has no server, keeps data on the device only, and talks only to Google.
  - Fill in the Google sign-in consent screen: app name "Magpie", logo (the new icon), support email, privacy policy link, and a home page link.
  - Check Google's current rules for apps that use YouTube data, including its branding rules and required links to its terms and privacy policy, before the sign-in review.
  - Write the store listing: a short description that says what the app does ("Move your YouTube subscriptions to another account"), screenshots, and a feature graphic. The listing text may name YouTube to describe the job, but the app name must not.
  - If the app uses its own Google sign-in button, check it against Google's button rules, or use Google's standard button.
  - Reserve a matching domain, support email address, and social handles if the brand will be used outside the stores.
  - Update the project's constitution title, which names the old product. This changes governing rules, so it is done with the constitution step, not here.
