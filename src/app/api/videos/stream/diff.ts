export interface StreamSnapshotItem {
  id: string;
  status: string;
  processingStatus?: string;
  thumbnailStatus?: string;
  storageConfirmedAt?: string;
}

const sig = (i: StreamSnapshotItem) =>
  `${i.status}|${i.processingStatus ?? ''}|${i.thumbnailStatus ?? ''}|${i.storageConfirmedAt ?? ''}`;

export function diffVideos(
  prev: Map<string, StreamSnapshotItem>,
  next: StreamSnapshotItem[],
): { changed: StreamSnapshotItem[]; snapshot: Map<string, StreamSnapshotItem> } {
  const snapshot = new Map<string, StreamSnapshotItem>();
  const changed: StreamSnapshotItem[] = [];
  for (const item of next) {
    snapshot.set(item.id, item);
    const before = prev.get(item.id);
    if (!before || sig(before) !== sig(item)) changed.push(item);
  }
  return { changed, snapshot };
}
