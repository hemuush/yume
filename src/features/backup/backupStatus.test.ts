import { backupStatus, formatBytes } from './backupStatus';

const NOW = new Date('2026-10-03T12:00:00');
const base = {
  folder: 'content://folder',
  lastAt: null,
  outcome: null,
  frequency: 'daily' as const,
  now: NOW,
};

describe('formatBytes', () => {
  it('picks B, KB or MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('backupStatus', () => {
  it('colours the shield by state: waiting, failed, then ok', () => {
    expect(backupStatus({ ...base, folder: null }).tone).toBe('waiting');
    expect(backupStatus(base).tone).toBe('waiting');
    expect(
      backupStatus({ ...base, outcome: { ok: false, error: 'x', at: '2026-10-03T08:00:00' } as never }).tone
    ).toBe('failed');
    expect(backupStatus({ ...base, lastAt: '2026-10-03T08:00:00' }).tone).toBe('ok');
  });

  it('asks for a folder first', () => {
    expect(backupStatus({ ...base, folder: null }).title).toBe('No backup folder yet');
  });

  it('reports a failed last backup with its reason, ahead of any success time', () => {
    const s = backupStatus({
      ...base,
      lastAt: '2026-10-02T09:00:00',
      outcome: { ok: false, error: 'Folder gone', at: '2026-10-03T08:00:00' } as never,
    });
    expect(s).toMatchObject({ title: 'Last backup failed', failed: true, lines: ['Folder gone'] });
  });

  it('prompts for a first backup when none has run', () => {
    expect(backupStatus(base).title).toBe('Not backed up yet');
  });

  it('says "Backed up today" for a backup made today', () => {
    const s = backupStatus({ ...base, lastAt: '2026-10-03T08:00:00' });
    expect(s).toMatchObject({ title: 'Backed up today', failed: false });
  });

  it('names the day for an older backup', () => {
    expect(backupStatus({ ...base, lastAt: '2026-10-01T08:00:00' }).title).toMatch(/^Backed up /);
    expect(backupStatus({ ...base, lastAt: '2026-10-01T08:00:00' }).title).not.toBe('Backed up today');
  });
});
