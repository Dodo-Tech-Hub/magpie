# Feature Specification: Subscription Migration

**Feature Branch**: `feature/subscription-migration`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Migrate YouTube subscriptions from one Google account (old/source) to another (new/destination), on Android and iOS, using a top bar with 3 steps (From, Pick, To), a channel list with checkboxes, in-place progress, and daily-limit handling."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move picked channels to a new account (Priority: P1)

A user has subscriptions on an old Google account and wants them on a new account. They sign in to the old account, see all channels they follow, pick the ones to bring over, sign in to the new account, and tap Move. Each channel row shows its progress in place, and a summary stays on screen when done.

**Why this priority**: This is the whole purpose of the app. Without it, nothing else has value.

**Independent Test**: Sign in to an old account with a few subscriptions and a new account with none, pick some channels, tap Move, and confirm the new account now follows exactly the picked channels.

**Acceptance Scenarios**:

1. **Given** the user is signed in to the old account, **When** they open the Pick step, **Then** they see every channel the old account follows, each with a checkbox, name, and picture.
2. **Given** both accounts are signed in and 12 channels are picked, **When** the user looks at the Move button, **Then** it reads "Move 12 channels".
3. **Given** both accounts are signed in and channels are picked, **When** the user taps Move, **Then** each picked row changes to "Moving…" and then "Moved", without leaving the screen.
4. **Given** a move has finished, **When** the user looks at the list, **Then** a summary such as "10 moved · 2 already there" stays on the screen.
5. **Given** a channel cannot be followed (for example, it no longer exists), **When** the move reaches it, **Then** its row shows "Couldn't move" and the move continues with the next channel.

---

### User Story 2 - Steps in any order with a clear top bar (Priority: P1)

A constant top bar shows the 3 steps: From (sign in to the old account), Pick (the channel list), and To (sign in to the new account). Each step shows an icon, one word, and its state. The user can tap any step to jump to it, in any order.

**Why this priority**: The chosen design depends on it. It is how the user moves around the app, so the P1 flow cannot be used without it.

**Independent Test**: Open the app fresh, tap each step in different orders, and confirm the right screen appears, the right step is highlighted, and Pick is locked until the old account is signed in.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user looks at the top of the screen, **Then** they always see the From, Pick, and To steps, each with an icon and one word.
2. **Given** the user is on any step, **When** they tap another step, **Then** that step's screen appears below the top bar and that step is highlighted as current.
3. **Given** the old account is not signed in, **When** the user looks at or taps Pick, **Then** Pick shows a lock and the screen says "Sign in to your old account first".
4. **Given** an account is signed in, **When** the user looks at its step, **Then** the step shows a done mark.
5. **Given** the user signs in to the new account first, **When** they later sign in to the old account, **Then** the flow still works and Pick unlocks.

---

### User Story 3 - See and switch the signed-in accounts (Priority: P2)

On each sign-in step the user sees which account is signed in (picture and email) and can switch to another account. The app stops the user from using the same account as both old and new.

**Why this priority**: It prevents the most common mistake (wrong or same account) but is not needed to prove the core move works.

**Independent Test**: Sign in to both steps, switch one of them, and try to sign in to the same account in both steps.

**Acceptance Scenarios**:

1. **Given** an account is signed in on a step, **When** the user views that step, **Then** they see the account's picture and email and a Switch button.
2. **Given** the old account is signed in, **When** the user signs in to the same account on the To step, **Then** the app refuses it and says "This is your old account. Pick a different one."
3. **Given** the user switches the old account, **When** the new old account is signed in, **Then** the channel list reloads for that account and earlier picks are cleared.
4. **Given** a move is running, **When** the user tries to switch either account, **Then** the app does not allow it until the move stops.

---

### User Story 4 - Find and pick channels fast (Priority: P2)

The channel list can be long. The user can search by name, pick or unpick all shown channels with one "All" checkbox, and always sees how many are picked, for example "12 of 340 picked".

**Why this priority**: It makes long lists manageable, but a short list works without it.

**Independent Test**: With an old account that follows many channels, search for a name, use All, and check the counter.

**Acceptance Scenarios**:

1. **Given** the list is shown, **When** the user types in the search box, **Then** only channels whose names match are shown.
2. **Given** some channels are shown, **When** the user taps the All checkbox, **Then** all shown channels that can be moved become picked; tapping it again unpicks them.
3. **Given** any picks change, **When** the user looks at the counter, **Then** it shows the number picked out of the total, for example "12 of 340 picked".
4. **Given** a search is active, **When** the user picks channels and clears the search, **Then** their picks are kept.

---

### User Story 5 - Skip channels already followed (Priority: P2)

After the new account is signed in, channels it already follows are marked "Already there" in the list. They cannot be picked and are not moved again.

**Why this priority**: It avoids wasted work and the daily limit, and it makes the result easy to understand, but the move works without it.

**Independent Test**: Use a new account that already follows 2 of the old account's channels and confirm those 2 show "Already there" and are skipped.

**Acceptance Scenarios**:

1. **Given** both accounts are signed in, **When** the list is shown, **Then** channels the new account already follows show "Already there" and their checkbox cannot be ticked.
2. **Given** some picked channels are already followed by the new account, **When** the user looks at the Move button, **Then** its count excludes those channels.

---

### User Story 6 - Daily limit, reminder, and continue later (Priority: P3)

YouTube allows only a limited number of follows per day for the whole app (about 200). When the limit is reached, the remaining rows show "Tomorrow" and the app says the daily limit is reached. Progress is saved. When the limit resets, the app sends a reminder, and the user taps Continue to move the rest.

**Why this priority**: Most users with a small number of channels will never hit it, but users with many channels need it to finish at all.

**Independent Test**: Simulate the daily limit after 6 channels, confirm the message and "Tomorrow" rows, simulate the limit reset, confirm the reminder appears, tap it, and confirm Continue moves only the remaining channels.

**Acceptance Scenarios**:

1. **Given** a move is running, **When** the daily limit is reached, **Then** remaining picked rows show "Tomorrow" and the screen shows "Daily limit reached. We'll remind you when you can move the rest."
2. **Given** the daily limit was reached for the first time and reminders are not yet allowed, **When** the message appears, **Then** the app explains why it wants to send a reminder and asks the user to allow reminders.
3. **Given** reminders are allowed and a progress is waiting, **When** the daily limit resets, **Then** the user gets a reminder such as "You can move the rest of your channels now."
4. **Given** the user taps the reminder, **When** the app opens, **Then** it shows that progress's channel list with a Continue button.
5. **Given** reminders are not allowed, **When** the user opens the app after the limit resets, **Then** they can still continue the progress manually.
6. **Given** a progress stopped at the daily limit, **When** the user taps Continue, **Then** only channels still waiting are moved.

---

### User Story 7 - Several saved progresses (Priority: P3)

A user can have more than one unfinished progress, for example from account A to B and from account C to D. Each saved progress belongs to one old and new account pair. Unfinished progresses are listed on the From screen. Tapping one opens it, asking the user to sign in again if they signed out.

**Why this priority**: Only users who migrate several accounts need it. One saved progress already covers the daily-limit case.

**Independent Test**: Start moving A to B and stop at the daily limit, then start moving C to D and stop at the daily limit, then confirm both appear in the list and each one continues with its own channels.

**Acceptance Scenarios**:

1. **Given** there are unfinished progresses, **When** the user opens the From screen, **Then** they see a list of unfinished progresses, each showing the old and new account and how many channels are left, for example "old.me → new.me · 12 left".
2. **Given** the user taps an unfinished progress and both of its accounts are still signed in, **When** the progress opens, **Then** the Pick screen shows that progress's channels, picks, and statuses.
3. **Given** the user taps an unfinished progress and one or both of its accounts are signed out, **When** the progress opens, **Then** the app asks the user to sign in to those exact accounts and refuses any other account.
4. **Given** the user signs in to an old and new account pair that has an unfinished progress, **When** the Pick screen loads, **Then** that saved progress is opened instead of a fresh list.
5. **Given** the user no longer wants an unfinished progress, **When** they delete it, **Then** it is removed from the list and from the device.
6. **Given** a progress finishes with no channels waiting, **When** the summary appears, **Then** the progress is no longer listed as unfinished.

---

### Edge Cases

- The old account follows no channels: the Pick screen says "This account doesn't follow any channels yet" and Move is not offered.
- The user taps Move with something missing: the app does not start and says what is missing in simple words, for example "Sign in to your new account first" or "Pick at least 1 channel".
- The user cancels or fails sign-in: the step stays signed out and shows "Sign-in didn't finish. Try again."
- The internet drops during a move: the move pauses, unfinished rows go back to waiting, and the user sees "No internet. Try again when you're online." Already moved channels stay moved.
- The user closes the app during a move: on return, moved channels stay marked as moved and the rest are waiting.
- The user's sign-in expires: the affected step shows signed out and asks the user to sign in again; saved progress is kept.
- Every picked channel is already followed by the new account: the move ends at once with a summary such as "0 moved · 5 already there".
- The user signs out: saved progresses stay on the device and need a new sign-in to continue.
- The user deletes app data: all saved progresses, lists, picks, and statuses are removed from the device.
- A progress's old or new account no longer exists or cannot sign in: the user can still delete that saved progress.

## Requirements *(mandatory)*

### Functional Requirements

**Top bar and navigation**

- **FR-001**: The app MUST show a top bar on every screen with 3 steps in this order: From, Pick, To.
- **FR-002**: Each step MUST show an icon and one word, and one of these states: current (highlighted), done (done mark), locked (lock), or not started.
- **FR-003**: Users MUST be able to tap any unlocked step to show its screen, in any order.
- **FR-004**: The Pick step MUST be locked until the old account is signed in and MUST explain "Sign in to your old account first".
- **FR-005**: The app MUST have exactly 3 screens below the top bar: sign in to old account, channel list, sign in to new account. Progress and results MUST appear on the channel list, not on extra screens.

**Accounts**

- **FR-006**: Users MUST be able to sign in to a Google account on the From step and on the To step.
- **FR-007**: Each sign-in step MUST show the signed-in account's picture and email, and a Switch button.
- **FR-008**: The app MUST refuse the same Google account for both old and new, with a simple message.
- **FR-009**: The app MUST only ask for read access on the old account and for permission to manage subscriptions on the new account.
- **FR-010**: Switching the old account MUST reload the channel list for the new old account. Any unfinished progress of the previous account pair MUST stay saved.
- **FR-011**: Users MUST NOT be able to switch accounts while a move is running.
- **FR-012**: Users MUST be able to sign out of each account and delete all app data, including every saved progress, from inside the app.

**Channel list**

- **FR-013**: The list MUST show every channel the old account follows, each with a checkbox, name, and picture.
- **FR-014**: The list MUST provide a search box that filters channels by name as the user types.
- **FR-015**: The list MUST provide an All checkbox that picks or unpicks all currently shown channels that can be moved.
- **FR-016**: The list MUST show a counter of picked channels out of the total, for example "12 of 340 picked".
- **FR-017**: All channels MUST be picked by default when the list first loads.
- **FR-018**: When the new account is signed in, channels it already follows MUST be marked "Already there", MUST NOT be pickable, and MUST NOT be moved.

**Moving**

- **FR-019**: A Move button MUST stay visible at the bottom of the list and show the number of channels that will be moved, for example "Move 12 channels".
- **FR-020**: Tapping Move without both accounts signed in or with no channels picked MUST NOT start a move and MUST show what is missing.
- **FR-021**: During a move, each picked row MUST update in place to one of: Moving…, Moved, Tomorrow, or Couldn't move.
- **FR-022**: A channel that fails MUST be marked "Couldn't move" and MUST NOT stop the rest of the move.
- **FR-023**: When a move ends, a summary MUST stay on the list screen with counts of moved, already there, and (if any) waiting and couldn't move.
- **FR-024**: The move MUST only add channels to the new account. The app MUST NOT change or remove anything on the old account.

**Daily limit, reminders, and saved progresses**

- **FR-025**: When the daily limit is reached, the app MUST stop the move, mark remaining picked rows "Tomorrow", and show "Daily limit reached. We'll remind you when you can move the rest."
- **FR-026**: The app MUST save each progress on the device (old and new account, picks, and each channel's status) so it survives closing the app.
- **FR-027**: Users MUST be able to continue a stopped progress with a Continue button, and it MUST only process channels still waiting.
- **FR-028**: The app MUST ask for permission to send reminders only when the daily limit is first reached, with a simple reason, for example "Can we remind you when you can move the rest?"
- **FR-029**: If reminders are allowed, the app MUST send one reminder per waiting progress when the daily limit resets. Tapping it MUST open that progress.
- **FR-030**: If reminders are not allowed, everything else MUST still work, and users continue manually.
- **FR-031**: Users MUST be able to have several saved progresses, at most one per old and new account pair.
- **FR-032**: The From screen MUST list unfinished progresses, each with both accounts and the number of channels left.
- **FR-033**: Opening a saved progress whose accounts are signed out MUST ask the user to sign in to those exact accounts and MUST refuse any other account.
- **FR-034**: Users MUST be able to delete a saved progress.
- **FR-035**: A progress with no channels waiting MUST no longer be listed as unfinished.

**Wording and look**

- **FR-036**: All text MUST use simple, everyday words with no technical terms.
- **FR-037**: Buttons and steps MUST have icons. Icon-only buttons are allowed only when the meaning is obvious.
- **FR-038**: The feature MUST behave the same on Android and iOS.

### Key Entities

- **Account**: A signed-in Google account in one role, old or new. Has a picture, email, and a unique identity used to stop the same account being used twice.
- **Channel**: A YouTube channel the old account follows. Has a name, picture, and unique identity.
- **Pick**: Whether the user chose a channel to move.
- **Channel status**: The state of a channel in the current move: waiting, moving, moved, already there, tomorrow, or couldn't move.
- **Progress**: The saved record of moving channels for one old and new account pair: both accounts, the picked channels, and each one's status. At most one per account pair. A progress is unfinished while any channel is waiting. Kept on the device only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can move 20 channels from one account to another in under 3 minutes, sign-ins included.
- **SC-002**: At least 90% of first-time test users finish a move without help.
- **SC-003**: After a move, the new account follows 100% of the picked channels that did not fail or wait for tomorrow.
- **SC-004**: No channel is ever followed twice or moved again after it was already moved or already there.
- **SC-005**: After closing and reopening the app, 100% of moved and waiting statuses are shown correctly.
- **SC-006**: Search results update while typing, with no visible delay, for lists of up to 2,000 channels.
- **SC-007**: Test users rate the wording as easy to understand (average 4 of 5 or higher).

## Assumptions

- Users already have both Google accounts and can sign in to them on the phone.
- The app only copies subscriptions and never removes anything from the old account. It does not copy watch history, likes, or notification settings.
- Playlists are out of scope for this feature and are a candidate for a separate, later feature.
- The daily limit is set by YouTube and shared by everyone using the app (about 200 follows per day). It resets once a day at midnight Pacific Time. The app cannot raise it on its own.
- All channels are picked by default because most users want to bring everything over.
- Saved progresses are stored only on the device; there is no cloud sync between devices.
- The only phone permission the app asks for is reminders (notifications), and only after the daily limit is first reached. Reminders are scheduled on the phone and need no server.
- Android ships first, but this spec applies to both Android and iOS.
