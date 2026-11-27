// iOS: keep the expo-sqlite folder (Documents/SQLite, where progress.db lives) out of iCloud and computer backups. Android has allowBackup: false.
const { withAppDelegate } = require('expo/config-plugins');

const ANCHOR = '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)';
const CODE = `    if var db = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.appendingPathComponent("SQLite") {
      try? FileManager.default.createDirectory(at: db, withIntermediateDirectories: true)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try? db.setResourceValues(values)
    }
`;

module.exports = (config) =>
  withAppDelegate(config, (c) => {
    const src = c.modResults.contents;
    if (src.includes('isExcludedFromBackup')) return c;
    if (!src.includes(ANCHOR)) throw new Error('withNoDbBackup: AppDelegate anchor not found');
    c.modResults.contents = src.replace(ANCHOR, CODE + ANCHOR);
    return c;
  });
