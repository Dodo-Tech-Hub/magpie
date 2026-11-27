import { timeLeftText } from '@/strings';

describe('timeLeftText', () => {
  it('says more than one session when the adds are over what the platform allows in an hour', () => {
    expect(timeLeftText(903, 301, 300)).toBe('More than one session');
    // The same adds fit in an hour on a platform that allows more.
    expect(timeLeftText(36, 301, 1500)).toBe('Less than a minute');
    expect(timeLeftText(1800, 1501, 1500)).toBe('More than one session');
  });

  it('gives minutes, rounded up, and "less than a minute" under 60 seconds', () => {
    expect(timeLeftText(59, 20, 300)).toBe('Less than a minute');
    expect(timeLeftText(60, 20, 300)).toBe('About 1 minute');
    expect(timeLeftText(241, 80, 300)).toBe('About 5 minutes');
  });
});
