import config from '../../app.config';
import pkg from '../../package.json';
describe('app identity', () => {
  it('is named Magpie', () => {
    expect(config.name).toBe('Magpie');
  });
});

describe('project identifiers', () => {
  const ids = {
    slug: config.slug,
    packageName: pkg.name,
    iosBundle: config.ios?.bundleIdentifier,
    androidPackage: config.android?.package,
  };

  it('share the Magpie name', () => {
    expect(ids.slug).toBe('magpie');
    expect(ids.packageName).toBe('magpie');
    expect(ids.iosBundle).toBe('io.github.dodotechhub.magpie');
    expect(ids.androidPackage).toBe('io.github.dodotechhub.magpie');
  });

  it('do not contain youtube', () => {
    for (const value of Object.values(ids)) expect(value).not.toMatch(/youtube/i);
  });
});
