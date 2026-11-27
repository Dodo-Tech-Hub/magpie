# Magpie Privacy Policy

**Effective date:** 2026-11-27

## The short version

- Magpie has no server. Everything it saves stays on your phone.
- Your information goes only to the platforms you connect (YouTube, GitHub, Bluesky), so Magpie can read your list and add it to your other account.
- We, the people who make Magpie, never receive your information. We don't sell it, share it, or use it for ads or AI.
- You can delete everything at any time: in Magpie, open Settings and tap "Delete all my data".

The rest of this page gives the details.

## Who makes Magpie?

Magpie is a free app made by Dodo Tech Hub ("we", "us"). It copies what you follow or subscribe to from one account (your "old" account) to another (your "new" account) on the same platform. This policy covers the Magpie app on Android and iOS.

## What does Magpie use?

When you connect an account, Magpie asks for your permission first. The platform shows you what Magpie asks for, and you can say no.

Magpie uses:

- **Your account details:** the account ID, username, name, email address (YouTube only), and profile photo. Magpie shows them so you can tell your two accounts apart.
- **Your lists:** what your old account follows or subscribes to, such as channels, people, starred projects, lists, blocks, mutes, or feeds. For each item: its ID, name, and picture.
- **Your progress:** which items you picked, and whether each one is waiting, moved, already there, or could not be moved.
- **Sign-in keys (tokens):** the platform gives Magpie a key so it can act for you. Magpie never sees or asks for your password.

Magpie does not use your location, contacts, photos, camera, microphone, or any other information on your phone. It has no analytics, no ads, no tracking, and no crash reporting.

## Why does Magpie use it?

Only to do what you ask: read your old account's list, show it to you, and add the items you pick to your new account. If you allow reminders, Magpie also uses your progress to remind you when you can move the rest.

Magpie does not use your information for anything else. If that ever changes, we will update this policy and ask you in the app before Magpie uses your information in a new way.

## Where is it kept, and for how long?

On your phone only. Magpie keeps:

| What | Where | How long |
|------|-------|----------|
| Account details, lists, progress, and your settings (such as Light or Dark look) | A small database inside the app | Until you delete it, or delete the move it belongs to, or uninstall Magpie |
| A record of when Magpie added items, so it stays inside each platform's limits | The same database | Until you delete it or uninstall Magpie |
| GitHub sign-in key for your new account | Your phone's secure storage | Up to 8 hours, then it expires |
| Bluesky sign-in keys | Your phone's secure storage | Until you sign out or delete your data. Bluesky ends Magpie's access within an hour if Magpie cannot cancel it |
| Google sign-in | Kept by Google's own sign-in tool on your phone, not by Magpie | Until you sign out, delete your data, or remove Magpie's access in your Google account |

On Android and iOS, Magpie keeps its data out of phone backups, so it is not copied to a cloud backup.

## Who receives it?

- **The platform you connect.** Magpie talks to YouTube (Google), GitHub, or Bluesky to read and change your lists. Pictures and profile photos load straight from that platform's image servers. Each platform handles your information under its own privacy policy. These companies may store information in other countries, such as the United States.
- **Nobody else.** We don't receive it, and Magpie has no server. We don't sell, rent, or share your information, and we don't use it for advertising, for credit or lending decisions, or to train AI.

When you open a help page from Magpie (for example about a platform's daily limit), it opens in your web browser on our website, which GitHub Pages hosts. GitHub may keep basic visit logs, such as your IP address, under its own privacy policy. The page asks for nothing about you.

## How is it protected?

- Sign-in keys stay in your phone's secure storage (Android Keystore, iOS Keychain), never in plain files.
- All connections to the platforms use encryption (HTTPS).
- Magpie asks each platform only for the permissions it needs. For the old account it asks only to read. For the new account it asks only to add what you picked.

## How do I delete my information or stop Magpie's access?

- **Everything:** in Magpie, open Settings and tap "Delete all my data". Magpie deletes everything it saved, cancels its reminders, and signs out of every platform. Where the platform allows it, Magpie also cancels its access there.
- **One move:** delete it from the list in Magpie.
- **Uninstall Magpie:** your phone deletes everything Magpie saved.
- **On the platform itself:** you can remove Magpie's access at any time in your account settings. See "Platform details" below for the link.

Deleting data in Magpie does not undo moves that already happened. The items stay followed on your new account until you remove them there.

## Your rights

Depending on where you live (for example under the EU and UK GDPR or California law), you have rights to see, correct, delete, or take a copy of your personal information, to object to how it is used, and to withdraw your permission.

Because all your information is on your phone and we never receive it, you can do all of this yourself in Magpie: see it on screen, and delete it in Settings. We have no copy that we could look up, change, or delete for you. You can still contact us with any question.

For the record, under the GDPR: Magpie uses your information because you asked it to do the move (Article 6(1)(b)), and it sends reminders only with your permission (Article 6(1)(a)), which you can withdraw in your phone's settings at any time. You don't have to connect any account, but Magpie cannot move anything without it. Magpie makes no automated decisions about you. You can complain to the data protection authority where you live.

Magpie does not track you across apps or websites, so it does not respond to "Do Not Track" signals: there is nothing to turn off.

## Reminders

If you allow it, Magpie reminds you when a platform's limit resets and you can move the rest. Your phone makes the reminder itself. It carries only an ID that points to your saved move, not your lists or account details. You can turn reminders off in your phone's settings at any time.

## Children

Magpie is not made for children under 13. You must also be old enough to have an account on each platform you connect, under that platform's rules. If you think a child used Magpie, use "Delete all my data" on that phone.

## Changes to this policy

When we change this policy, we update the date at the top and publish the new version at this same address. If a change affects how Magpie uses your information, Magpie tells you in the app before the change applies.

## Contact

Questions or complaints about privacy: open an issue at https://github.com/Dodo-Tech-Hub/magpie/issues. Please don't post personal information there.

## Platform details

### YouTube (Google)

- Magpie uses **YouTube API Services**. By using Magpie with YouTube, you agree to the [YouTube Terms of Service](https://www.youtube.com/t/terms). Google's handling of your information is covered by the [Google Privacy Policy](http://www.google.com/policies/privacy).
- Permissions: read-only access to your YouTube account for the old account (`youtube.readonly`), and access to manage your YouTube account for the new account (`youtube`), which Magpie uses only to subscribe to the channels you pick.
- Magpie's use and transfer of information received from Google APIs follows the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.
- To remove Magpie's access to your Google account: https://security.google.com/settings/security/permissions. Magpie also cancels its Google access when you tap "Delete all my data".

### GitHub

- For the old account, Magpie signs in with no extra permissions and reads only what is public: your stars, follows, lists, and starred gists. It keeps this sign-in in memory only, never on your phone's storage.
- For the new account, Magpie asks only for the permissions needed for the kinds of items you picked (for example to star projects or follow people).
- GitHub's access ends on its own within 8 hours. To end it sooner: https://github.com/settings/applications. GitHub's handling of your information is covered by the [GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

### Bluesky

- For the old account, you type your username. Magpie looks up your account through Bluesky's public services (including the PLC directory) and reads your public follows, blocks, and lists. To read private items (mutes and saved feeds), Magpie asks you to sign in, reads them once, and then signs out.
- For the new account, Magpie asks only to add the kinds of items you picked. If you type a username or email here, Magpie passes it only to Bluesky's sign-in page, never to a public lookup.
- Magpie talks to your account's own server and to Bluesky's public services. Bluesky's handling of your information is covered by the [Bluesky Privacy Policy](https://bsky.social/about/support/privacy-policy).
- Magpie cancels its access when you sign out or delete your data. If it cannot, the access ends on its own within an hour.

Magpie is not made by, linked with, or endorsed by YouTube, Google, GitHub, or Bluesky. YouTube is a trademark of Google LLC. GitHub is a trademark of GitHub, Inc. Bluesky belongs to Bluesky Social PBC.
