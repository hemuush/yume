/**
 * A category's icon, end to end on a real SQLite engine: what is saved, what an edit, an archive, a delete and its undo
 * leave behind, and how it travels through a backup (the file you share, and the folder backup) to a new phone.
 * A built-in name and a person's own emoji must both survive every step exactly, and nothing else may be stored.
 */
import { createRealDataTestDb, type AsyncDb } from '@/test-support/realDataTestDb';

let mockDb: AsyncDb = createRealDataTestDb();
jest.mock('./client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));
jest.mock('@/lib/appLock', () => ({ withoutRelock: (fn: () => unknown) => fn() }));
// The folder backup writes through Android's storage access framework: an in-memory folder stands in for it.
const mockFiles = new Map<string, string>();
jest.mock('expo-file-system/legacy', () => ({
  StorageAccessFramework: {
    readDirectoryAsync: async () => [...mockFiles.keys()],
    createFileAsync: async (dir: string, name: string) => {
      const uri = `${dir}/${name}`;
      mockFiles.set(uri, '');
      return uri;
    },
    writeAsStringAsync: async (uri: string, content: string) => {
      mockFiles.set(uri, content);
    },
    readAsStringAsync: async (uri: string) => mockFiles.get(uri) ?? '',
    deleteAsync: async (uri: string) => {
      mockFiles.delete(uri);
    },
    requestDirectoryPermissionsAsync: jest.fn(),
  },
}));

import { CREATE_TABLES_SQL } from './schema';
import {
  archiveCategory,
  createCategory,
  deleteCategory,
  listCategories,
  restoreCategory,
  unarchiveCategory,
  updateCategory,
} from './categories';
import { resetSettingsCache } from './settings';
import { BACKUP_FORMAT_VERSION, buildBackupSnapshot, restoreFromSnapshot } from '@/lib/backup';
import { readLocalBackup, writeLocalBackupNow } from '@/lib/localBackup';

const COFFEE = '☕';
const RAMEN = '\u{1F35C}';
const FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}';
const FLAG = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';

async function freshPhone() {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
}
const iconOf = async (name: string) => (await listCategories(true)).find((c) => c.name === name)?.icon;
const iconsByName = async () => Object.fromEntries((await listCategories(true)).map((c) => [c.name, c.icon]));

beforeEach(async () => {
  mockFiles.clear();
  await freshPhone();
});

describe('saving a category icon', () => {
  it('stores a built-in name, an emoji and a joined emoji exactly as given', async () => {
    await createCategory({ name: 'Rent', kind: 'expense', icon: 'home' });
    await createCategory({ name: 'Coffee runs', kind: 'expense', icon: COFFEE });
    await createCategory({ name: 'Family', kind: 'expense', icon: FAMILY });
    await createCategory({ name: 'England', kind: 'expense', icon: FLAG });
    expect(await iconsByName()).toEqual({
      Rent: 'home',
      'Coffee runs': COFFEE,
      Family: FAMILY,
      England: FLAG,
    });
  });

  it('keeps a built-in name that the picker no longer lists', async () => {
    await createCategory({ name: 'Fuel', kind: 'expense', icon: 'gas-station' });
    expect(await iconOf('Fuel')).toBe('gas-station');
  });

  it('uses the tag when no icon is given, and for anything that is not an icon', async () => {
    await createCategory({ name: 'None', kind: 'expense' });
    const bad: [string, unknown][] = [
      ['Empty', ''],
      ['Spaces', '   '],
      ['Words', 'Not An Icon'],
      ['Two emoji', COFFEE + RAMEN],
      ['Emoji and letter', COFFEE + 'x'],
      ['Markup', '<b>x</b>'],
      ['Long', 'x'.repeat(500)],
      ['Number', 42],
    ];
    for (const [name, icon] of bad) await createCategory({ name, kind: 'expense', icon: icon as string });
    const saved = await iconsByName();
    expect(saved.None).toBe('tag');
    for (const [name] of bad) expect(saved[name]).toBe('tag');
  });

  it('changes the icon on an edit, to an emoji and back, and never to something invalid', async () => {
    const category = await createCategory({ name: 'Food', kind: 'expense', icon: 'silverware-fork-knife' });
    await updateCategory(category.id, { name: 'Food', icon: RAMEN, color: category.color });
    expect(await iconOf('Food')).toBe(RAMEN);
    await updateCategory(category.id, { name: 'Food', icon: 'cart', color: category.color });
    expect(await iconOf('Food')).toBe('cart');
    await updateCategory(category.id, { name: 'Food', icon: COFFEE + RAMEN, color: category.color });
    expect(await iconOf('Food')).toBe('tag');
  });

  it('keeps an emoji through a rename, a colour change, archive and restore', async () => {
    const category = await createCategory({ name: 'Pets', kind: 'expense', icon: '\u{1F436}' });
    await updateCategory(category.id, { name: 'Pet care', icon: '\u{1F436}', color: '#FFA8CE' });
    await archiveCategory(category.id);
    expect(await iconOf('Pet care')).toBe('\u{1F436}');
    await unarchiveCategory(category.id);
    expect(await iconOf('Pet care')).toBe('\u{1F436}');
  });

  it('brings the emoji back when a delete is undone, for a category and its subcategories', async () => {
    const parent = await createCategory({ name: 'Eating out', kind: 'expense', icon: RAMEN });
    await createCategory({ name: 'Cafes', kind: 'expense', icon: COFFEE, parentId: parent.id });
    const snapshot = await deleteCategory(parent.id);
    expect(await iconsByName()).toEqual({});
    await restoreCategory(snapshot);
    expect(await iconsByName()).toEqual({ 'Eating out': RAMEN, Cafes: COFFEE });
  });
});

describe('through a backup to a new phone', () => {
  async function seedIcons() {
    const parent = await createCategory({ name: 'Eating out', kind: 'expense', icon: RAMEN });
    await createCategory({ name: 'Cafes', kind: 'expense', icon: COFFEE, parentId: parent.id });
    await createCategory({ name: 'Fuel', kind: 'expense', icon: 'gas-station' });
    await createCategory({ name: 'Family', kind: 'income', icon: FAMILY });
    await createCategory({ name: 'England', kind: 'expense', icon: FLAG });
    await createCategory({ name: 'Plain', kind: 'expense' });
    return iconsByName();
  }

  it('keeps every icon in the file you save and share, and in a restore of it on a fresh phone', async () => {
    const before = await seedIcons();
    // The exact text the app writes for "Save backup file": pretty-printed JSON.
    const text = JSON.stringify(await buildBackupSnapshot(), null, 2);
    expect(text).toContain(COFFEE);
    await freshPhone();
    const result = await restoreFromSnapshot(JSON.parse(text));
    expect(result.skippedColumns).toEqual([]);
    expect(await iconsByName()).toEqual(before);
  });

  it('keeps every icon in the folder backup, read back the way restore reads it', async () => {
    const before = await seedIcons();
    await writeLocalBackupNow('content://backups');
    const [uri] = [...mockFiles.keys()];
    expect(mockFiles.get(uri)).toContain(RAMEN);
    const snapshot = await readLocalBackup(uri);
    await freshPhone();
    await restoreFromSnapshot(snapshot);
    expect(await iconsByName()).toEqual(before);
  });

  it('restores over a phone that already has other categories and icons', async () => {
    const before = await seedIcons();
    const snapshot = JSON.parse(JSON.stringify(await buildBackupSnapshot()));
    await freshPhone();
    await createCategory({ name: 'Old phone category', kind: 'expense', icon: '\u{1F355}' });
    await restoreFromSnapshot(snapshot);
    expect(await iconsByName()).toEqual(before);
  });

  it('restores a backup made before custom emoji existed, with icons the picker no longer lists', async () => {
    await createCategory({ name: 'Pets', kind: 'expense', icon: 'paw' });
    await createCategory({ name: 'Gym', kind: 'expense', icon: 'dumbbell' });
    const snapshot = JSON.parse(JSON.stringify(await buildBackupSnapshot()));
    snapshot.formatVersion = 5;
    await freshPhone();
    await restoreFromSnapshot(snapshot);
    expect(await iconsByName()).toEqual({ Pets: 'paw', Gym: 'dumbbell' });
  });

  it('turns an icon that is not one into the tag on restore, and restores everything else in the file', async () => {
    await createCategory({ name: 'Good emoji', kind: 'expense', icon: COFFEE });
    await createCategory({ name: 'Good name', kind: 'expense', icon: 'car' });
    const snapshot = JSON.parse(JSON.stringify(await buildBackupSnapshot()));
    const damaged = [
      ['Numeric', 12345],
      ['Empty', ''],
      ['Words', 'Not An Icon'],
      ['Two emoji', COFFEE + RAMEN],
      ['Markup', '<script>alert(1)</script>'],
      ['Huge', 'x'.repeat(5000)],
      ['Null', null],
    ] as const;
    const template = snapshot.tables.categories[0];
    damaged.forEach(([name, icon], i) => {
      snapshot.tables.categories.push({ ...template, id: `damaged-${i}`, name, icon });
    });
    await freshPhone();
    const result = await restoreFromSnapshot(snapshot);
    expect(result.skippedColumns).toEqual([]);
    const restored = await iconsByName();
    expect(restored['Good emoji']).toBe(COFFEE);
    expect(restored['Good name']).toBe('car');
    for (const [name] of damaged) expect(restored[name]).toBe('tag');
  });

  it('is the same backup format as before: no new column, no new version', async () => {
    await createCategory({ name: 'Coffee runs', kind: 'expense', icon: COFFEE });
    const snapshot = await buildBackupSnapshot();
    expect(snapshot.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(BACKUP_FORMAT_VERSION).toBe(6);
    expect(Object.keys(snapshot.tables.categories[0]).sort()).toEqual(
      [
        'archived',
        'color',
        'icon',
        'id',
        'is_sensitive',
        'is_system',
        'kind',
        'name',
        'parent_id',
        'sort_order',
      ].sort()
    );
  });
});
