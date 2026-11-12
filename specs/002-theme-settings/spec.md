# Feature Specification: Theme and Settings

**Feature Branch**: `feature/subscription-migration` (no new branch made; the owner decides where this work lands)

**Created**: 2026-11-10

**Status**: Implemented

**Input**: User description: "Add a dark and light theme to the app, and a settings page where the user can choose the theme. Theme choices: Light, Dark, and follow the phone's setting. The choice is remembered on the device. Applies on Android and iOS. The settings page is the home for this and future app options; it should respect the project constitution's screen-minimizing principle (open from the main screen with an icon, keep it light) and the existing "Delete all data" action may live there."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose a theme (Priority: P1)

A user opens Settings from the main screen, sees three theme choices (Light, Dark, Auto), and taps one. The whole app changes look at once. The next time the user opens the app, the same look is used.

**Why this priority**: This is the core of the feature. Without a visible, working choice, nothing else matters. It also helps users who use the app at night or have sensitive eyes.

**Independent Test**: Open Settings, tap Dark, and see every screen turn dark. Close and reopen the app and see it is still dark. Repeat for Light.

**Acceptance Scenarios**:

1. **Given** the app is in Light, **When** the user taps Dark in Settings, **Then** every screen shows the dark look right away, with no restart.
2. **Given** the user chose Dark, **When** the app is closed and opened again, **Then** it opens in Dark.
3. **Given** the user chose Light, **When** the user goes back to the main screen, **Then** the main screen, the top bar, the lists, and all buttons show the light look.

---

### User Story 2 - Follow the phone's setting (Priority: P2)

A user who picks "Auto" gets the same look as the rest of their phone. When the phone switches between light and dark (by hand or on a schedule), the app switches too, while it is open or the next time it opens.

**Why this priority**: Most people already set their phone to switch by time of day. Following it means they never have to open Settings again. It is the default for new users.

**Independent Test**: Pick "Auto", change the phone to dark, and see the app turn dark. Change the phone to light and see the app turn light.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** the user opens the app for the first time, **Then** "Auto" is selected and the app matches the phone.
2. **Given** "Auto" is selected and the app is open, **When** the phone switches to dark, **Then** the app turns dark without a restart.
3. **Given** the user picked Light or Dark by hand, **When** the phone switches look, **Then** the app does not change.

---

### User Story 3 - Find Settings and manage app options in one place (Priority: P2)

A user sees a Settings icon on the main screen, taps it, and lands on a small Settings view without leaving the flow of the app. Settings holds the theme choice and the "Delete all my data" action. A back icon returns the user to where they were, with their steps and picks unchanged.

**Why this priority**: The owner wants one home for current and future options. Keeping it small and reachable with one tap follows the project rule to keep screens and taps low.

**Independent Test**: From any step, tap the Settings icon, see the theme choice and "Delete all my data", tap back, and land on the same step with nothing lost.

**Acceptance Scenarios**:

1. **Given** the user is on any step (From, Pick, or To), **When** the user taps the Settings icon, **Then** Settings opens in one tap.
2. **Given** the user has picked channels or a move is running, **When** the user opens Settings and goes back, **Then** the same step shows with the same picks and the move keeps going.
3. **Given** the user is in Settings, **When** the user taps "Delete all my data" and confirms, **Then** all saved data is removed and the user is signed out, as before.
4. **Given** the user is in Settings, **When** the user taps "Delete all my data" and cancels, **Then** nothing is deleted.

---

### Edge Cases

- The phone has no light or dark setting to report: "Auto" shows Light.
- The saved choice cannot be read (first run, or data is damaged): the app uses "Auto" and shows no error.
- The user changes the theme while a move is running: the look changes, and the move is not paused, stopped, or restarted.
- The user taps "Delete all my data": the theme choice is also removed, and the app goes back to "Auto".
- The user opens Settings while on the To step with an account sign-in in progress: Settings opens and going back returns to the same sign-in state.
- Text and icons stay easy to read in both looks: no light text on a light background, and no dark text on a dark background, on any screen or state (picked, locked, done, error, "Already there", "Tomorrow").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST offer three theme choices: Light, Dark, and Auto (Auto follows the phone).
- **FR-002**: The theme MUST apply to every screen, view, control, and message in the app, including the top bar, step views, channel rows, status labels, dialogs, and Settings.
- **FR-003**: A theme change MUST show right away, with no restart and no loss of the user's place, picks, or running move.
- **FR-004**: Auto MUST be the default for new users.
- **FR-005**: When Auto is chosen, the app MUST follow the phone's current light or dark mode, including changes made while the app is open.
- **FR-006**: When Light or Dark is chosen, the app MUST keep that look no matter what the phone does.
- **FR-007**: The app MUST remember the theme choice on the device and use it on the next open, before the first screen is drawn, so the user does not see a flash of the wrong look.
- **FR-008**: The main screen MUST show a Settings icon that opens Settings in one tap, from every step. The icon MUST have an accessibility label and a short text label unless the icon alone is obvious.
- **FR-009**: Settings MUST open in place of the current step view and MUST have a back icon that returns the user to the same step with state unchanged.
- **FR-010**: Settings MUST show the three theme choices as an inline choice (not a dropdown or a new screen), with the current choice clearly marked.
- **FR-011**: Settings MUST include the existing "Delete all my data" action, with the same confirmation and result as today (FR-012 and FR-034 of the migration spec). It MUST NOT appear in two places.
- **FR-012**: Settings MUST be built so a future option can be added as one more row without redesigning the view.
- **FR-013**: All Settings text MUST use simple, everyday words, and every control MUST have an icon and an accessibility label.
- **FR-014**: Text and icons MUST be readable in both looks. Normal text MUST have enough contrast against its background in Light and in Dark.
- **FR-015**: Deleting all data MUST also remove the saved theme choice, so the app goes back to Auto.
- **FR-016**: The feature MUST behave the same on Android and iOS. Any difference MUST be written in the plan (for example, how the phone reports its mode, or the status bar color).
- **FR-017**: The feature MUST NOT add any device permission, network call, or account data.

### Key Entities

- **Theme choice**: The user's pick: Light, Dark, or Auto. One value per device. Default: Auto. Stored only on the device, removed by "Delete all my data".
- **Look (resolved theme)**: The look actually shown, Light or Dark. It comes from the theme choice, and from the phone's mode when the choice is Auto.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can change the theme in 2 taps from any step (open Settings, tap a choice) and see the whole app change within 1 second.
- **SC-002**: After closing and reopening the app, the chosen theme shows on the first screen drawn, with no visible switch from the other look, in 100% of tries.
- **SC-003**: With Auto chosen, the app matches the phone's mode within 1 second of the phone changing it, in 100% of tries.
- **SC-004**: 100% of screens and states listed in the edge cases pass a readability check in both looks (no text or icon that is hard to see).
- **SC-005**: Opening Settings and going back never changes the step, picks, or progress of a running move (0 lost items in all manual tests).
- **SC-006**: 9 out of 10 first-time users find the theme choice from the main screen without help.

## Assumptions

- Auto is the default because most phones already switch light and dark by time of day.
- Settings is one extra view reached by an icon, and not a new navigation system. This fits the project rule to keep screens low. The plan must justify it as a new screen, as the constitution requires.
- The Settings icon lives on the main screen's fixed top area, next to the step bar, so it is visible from all three steps.
- "Delete all my data" moves from the From step to Settings, so it exists in one place. The owner may keep it also on From if preferred; this is a design choice for the plan, not a scope change.
- Only the theme and "Delete all my data" are in Settings for now. Reminder options and other settings are out of scope.
- The app's brand color for key actions stays the same in both looks, adjusted only where needed for contrast.
- App icon, splash screen, and store images are out of scope.
- No language choice, text size choice, or custom colors in this version.
- This feature depends on the existing on-device storage and the existing "Delete all my data" action from the migration feature.
