import type { Dispatch } from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { Action } from '@/state/AppState';
import { listUnfinished } from '@/store/progressStore';
import { strings } from '@/strings';

export type PlatformId = 'youtube';
export type Section = 'automatic' | 'guided';

export type Platform = {
  id: PlatformId;
  name: string;
  label: string;
  logo: ImageSourcePropType;
  section: Section;
  ready: boolean;
  open: (dispatch: Dispatch<Action>) => void;
  unfinished: () => Promise<{ left: number; ids: string[] }>;
};

// The one list Home reads. Adding or moving a platform is a change here (FR-003, SC-003).
export const PLATFORMS: Platform[] = [
  {
    id: 'youtube',
    name: strings.platformYoutube,
    label: strings.youtubeLine,
    logo: require('../../assets/platforms/youtube.png'),
    section: 'automatic',
    ready: true,
    open: (dispatch) => dispatch({ type: 'openPlatform', platform: 'youtube' }),
    unfinished: async () => {
      const list = await listUnfinished();
      return { left: list.reduce((n, p) => n + p.left, 0), ids: list.map((p) => p.id) };
    },
  },
];

const SECTIONS: Section[] = ['automatic', 'guided'];

// Ready platforms only, Automatic first, no empty section (FR-001).
export function readyBySection(list: Platform[] = PLATFORMS): { section: Section; platforms: Platform[] }[] {
  return SECTIONS.map((section) => ({
    section,
    platforms: list.filter((p) => p.ready && p.section === section),
  })).filter((g) => g.platforms.length > 0);
}
