# Contract: The List of Platforms

Every platform feature (Automatic or Guided) plugs into Home through one entry in `src/platforms/platforms.ts`. Home never names a platform in its own code.

## Shape

```ts
type Section = 'automatic' | 'guided';

type Platform = {
  id: PlatformId;
  name: string;
  logo: ImageSourcePropType;
  section: Section;
  ready: boolean;
  open: (dispatch: Dispatch<Action>) => void;
  unfinished: () => Promise<{ left: number; ids: string[] }>;
};
```

## Rules

| Rule | Source |
| --- | --- |
| Home shows only entries with `ready: true`. | FR-001, clarification 2026-11-12 |
| A section with no ready entry is not drawn, header included. | FR-001 |
| Automatic is drawn before Guided. | Spec title, FR-001 |
| A card shows the logo and the name, centered, and nothing else. Cards follow the order of the array. | FR-002 |
| A section header reads "Automatic" or "Guided" and is a heading. | FR-015 |
| A card's accessibility label is the name. The logo is hidden from screen readers. | FR-006, FR-017 |
| Card body and Continue note are separate tap targets, each at least 48 x 48 points. The note's accessibility label is `"Continue <name>, <n> left"`. | FR-016, FR-017 |
| The note is added once `unfinished()` returns, with no loading indicator, and updates when the count changes. | FR-019, edge case |
| A logo that fails to load is hidden; the name stays. | FR-020 |
| Continue note shows when `left > 0`. Tap with one id opens that progress; with several ids, opens the platform's own unfinished list. | FR-007 |
| Card body tap calls `open`. | FR-004, FR-005 |
| Adding a platform: one entry, one logo file, strings, and the platform's own flow. No change to `HomeView` or `PlatformCard`. | FR-003, SC-003 |
| Moving a platform between sections: change `section` only. | Edge case |
| Delete all MUST remove the data of every platform. A platform that adds stored data extends `deleteAll()` in the same change. | FR-011 |

## YouTube entry at launch

| Field | Value |
| --- | --- |
| `id` | `'youtube'` |
| `name` | "YouTube" |
| `section` | `'automatic'` |
| `ready` | `true` |
| `open` | dispatch `openPlatform { platform: 'youtube' }` |
| `unfinished` | sum of `left` from `listUnfinished()` |

## Strings added

| Key | Text |
| --- | --- |
| `homeTitle` | "Magpie" |
| `home` | "Home" |
| `sectionAutomatic` | "Automatic" |
| `sectionGuided` | "Guided" |
| `platformYoutube` | "YouTube" |
| `continueLeft(n)` | "Continue: n left" |
| `continueLabel(name, n)` | "Continue name, n left" |
