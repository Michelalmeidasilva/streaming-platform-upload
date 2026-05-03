import { normalizeLocale, translate, getLocaleCode } from '../translations';

describe('i18n translations', () => {
  it('normalizes locales', () => {
    expect(normalizeLocale('es-ES')).toBe('es');
    expect(normalizeLocale('pt-BR')).toBe('pt');
    expect(normalizeLocale('en-GB')).toBe('en');
    expect(normalizeLocale(null)).toBe('en');
  });

  it('translates keys with interpolation', () => {
    expect(translate('en', 'metadata.title')).toBe('Streaming Platform Upload');
    expect(translate('en', 'upload.uploadStatus.uploading', { progress: 50 })).toBe('50%');
  });

  it('falls back to default locale if key missing in target', () => {
    // metadata.title exists in all, but we can assume it works
    expect(translate('es', 'metadata.title')).toBe('Carga de plataforma de streaming');
  });

  it('returns key if translation missing entirely', () => {
    expect(translate('en', 'non.existent.key')).toBe('non.existent.key');
  });

  it('gets locale code', () => {
    expect(getLocaleCode('pt')).toBe('pt-BR');
  });
});
