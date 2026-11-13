# Contract: The List of Platforms

Every platform feature (Automatic or Guided) plugs into Home through one entry in `src/platforms/platforms.ts`. Home never names a platform in its own code.

## Shape

```ts
type Section = 'automatic' | 'guided';

type Platform = {
  id: PlatformId;
  name: string;
  label: string;
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
| A card's accessibility label is `"<name>. <label>"`. | FR-006 |
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
| `label` | "We move them for you" |
| `section` | `'automatic'` |
| `ready` | `true` |
| `open` | dispatch `openPlatform { platform: 'youtube' }` |
| `unfinished` | sum of `left` from `listUnfinished()` |

## Strings added

| Key | Text |
| --- | --- |
| `home` | "Home" |
| `sectionAutomatic` | "Automatic" |
| `sectionGuided` | "Guided" |
| `youtubeLine` | "We move them for you" |
| `guidedLine` | "Step-by-step guide" |
| `continueLeft(n)` | "Continue: n left" |
