import { PRODUCTION_RECOVERY_POLICY, getRecoveryPolicy } from '../recovery-policy';

describe('recovery policy', () => {
  it('requires versioning plus backup or replication posture for production', () => {
    expect(PRODUCTION_RECOVERY_POLICY).toEqual({
      versioning: 'required',
      backupTarget: 'required',
      replicationTarget: 'required',
      accidentalDeletionRecovery: 'versioning-plus-backup',
      regionalLossRecovery: 'replication-plus-backup',
    });
  });

  it('returns the canonical production recovery policy', () => {
    expect(getRecoveryPolicy()).toBe(PRODUCTION_RECOVERY_POLICY);
  });
});

