# Contract: UI states

One screen: a fixed top bar and one step view below it. All text comes from `src/strings.ts`; examples below are the intended wording.

## Top bar

| Step | Icon (idea) | Word | States |
|------|-------------|------|--------|
| From | person | From | current, done (old account list loaded), not started |
| Pick | list with checks | Pick | current, done (no picked channel left waiting), locked (no old account list), not started |
| To | person with plus | To | current, done (new account signed in), not started |

- Tapping an unlocked step shows its view. Tapping locked Pick shows the Pick view with the lock message.
- After signing in to the old account, the app goes to Pick. After signing in to the new account, it goes to Pick.

## From view

- Signed out: title "Old account", hint "Where your channels are now", button "Sign in with Google".
- Signed in: photo, email, "Switch" button.
- Below: "Unfinished" list, each row "old.me → new.me · 12 left" with a delete icon button. Tapping a row opens that progress (asks for new account sign-in if needed, R2).

## To view

- Same card as From, with title "New account" and hint "Where your channels should go".
- Same-account refusal: "This is your old account. Pick a different one."

## Pick view

| State | What shows |
|-------|-----------|
| Locked | Lock icon, "Sign in to your old account first" |
| Empty | "This account doesn't follow any channels yet" |
| Ready | Search box, All checkbox, "12 of 340 picked", list rows (checkbox, photo, name, status tag), bottom bar "Move 12 channels" |
| Moving | Rows update: "Moving…", "Moved", "Couldn't move"; bottom bar "Moving…" (not tappable); Switch buttons disabled |
| Limit hit | Remaining rows "Tomorrow"; message "Daily limit reached. We'll remind you when you can move the rest."; bottom bar "Continue" |
| Done | Summary "10 moved · 2 already there" (plus "· 1 couldn't move" if any) |

Missing-requirement messages on Move: "Sign in to your new account first", "Pick at least 1 channel".

## Reminder

- Permission ask (first daily-limit hit): "Can we remind you when you can move the rest?"
- Reminder text: "You can move the rest of your channels now."
- Tapping it opens Pick for that progress with "Continue".
