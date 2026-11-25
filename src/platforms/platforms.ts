import type { Dispatch } from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { Driver } from '@/platforms/driver';
import { githubDriver } from '@/platforms/githubDriver';
import { youtubeDriver } from '@/platforms/youtubeDriver';
import type { Action } from '@/state/AppState';
import { listUnfinished } from '@/store/progressStore';
import { strings } from '@/strings';

export type PlatformId = 'youtube' | 'github' | 'bluesky';
export type Section = 'automatic' | 'guided';

export type Platform = {
  id: PlatformId;
  name: string;
  logo: ImageSourcePropType;
  // Shown on the dark look, when the logo needs a different color.
  logoDark?: ImageSourcePropType;
  driver: Driver;
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
    logo: require('../../assets/platforms/youtube.png'),
    section: 'automatic',
    ready: true,
    driver: youtubeDriver,
    open: (dispatch) => dispatch({ type: 'openPlatform', platform: 'youtube' }),
    unfinished: async () => {
      const list = await listUnfinished('youtube');
      return { left: list.reduce((n, p) => n + p.left, 0), ids: list.map((p) => p.id) };
    },
  },
  {
    id: 'github',
    name: strings.platformGithub,
    logo: require('../../assets/platforms/github.png'),
    logoDark: require('../../assets/platforms/github-white.png'),
    section: 'automatic',
    ready: true,
    driver: githubDriver,
    open: (dispatch) => dispatch({ type: 'openPlatform', platform: 'github' }),
    unfinished: async () => {
      const list = await listUnfinished('github');
      return { left: list.reduce((n, p) => n + p.left, 0), ids: list.map((p) => p.id) };
    },
  },
];

export function driverFor(id: PlatformId): Driver {
  const p = PLATFORMS.find((x) => x.id === id);
  if (!p) throw new Error(`No platform ${id}`);
  return p.driver;
}

const SECTIONS: Section[] = ['automatic', 'guided'];

// Ready platforms only, Automatic first, no empty section (FR-001).
export function readyBySection(list: Platform[] = PLATFORMS): { section: Section; platforms: Platform[] }[] {
  return SECTIONS.map((section) => ({
    section,
    platforms: list.filter((p) => p.ready && p.section === section),
  })).filter((g) => g.platforms.length > 0);
}
