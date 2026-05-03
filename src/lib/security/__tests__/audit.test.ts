import { recordSecurityEvent } from '../audit';

describe('Audit Security', () => {
  it('logs security events to console info', () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    const event = {
      type: 'access_denied' as const,
      route: '/api/test',
      method: 'POST',
      reason: 'test',
      status: 403,
    };

    recordSecurityEvent(event);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"type":"access_denied"'));
    consoleSpy.mockRestore();
  });
});
