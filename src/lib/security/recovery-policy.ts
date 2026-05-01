import type { RecoveryPolicy } from '@/types';

export const PRODUCTION_RECOVERY_POLICY: RecoveryPolicy = {
  versioning: 'required',
  backupTarget: 'required',
  replicationTarget: 'required',
  accidentalDeletionRecovery: 'versioning-plus-backup',
  regionalLossRecovery: 'replication-plus-backup',
};

export function getRecoveryPolicy(): RecoveryPolicy {
  return PRODUCTION_RECOVERY_POLICY;
}

