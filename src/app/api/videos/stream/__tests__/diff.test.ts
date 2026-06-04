import { diffVideos, type StreamSnapshotItem } from '../diff';

const v = (over: Partial<StreamSnapshotItem>): StreamSnapshotItem =>
  ({ id: 'a', status: 'processing', processingStatus: 'transcoding', thumbnailStatus: 'pending', ...over });

describe('diffVideos', () => {
  it('emits all on first run (empty prev)', () => {
    const { changed } = diffVideos(new Map(), [v({ id: 'a' })]);
    expect(changed.map((c) => c.id)).toEqual(['a']);
  });
  it('emits only items whose tracked fields changed', () => {
    const prev = new Map([['a', v({ id: 'a' })], ['b', v({ id: 'b' })]]);
    const { changed } = diffVideos(prev, [v({ id: 'a', status: 'ready' }), v({ id: 'b' })]);
    expect(changed.map((c) => c.id)).toEqual(['a']);
  });
  it('emits nothing when unchanged', () => {
    const prev = new Map([['a', v({ id: 'a' })]]);
    const { changed } = diffVideos(prev, [v({ id: 'a' })]);
    expect(changed).toHaveLength(0);
  });
});
