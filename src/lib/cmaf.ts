import { getMaxFileSizeBytes } from './uploadLimits';

const SUPPORTED_FORMATS = ['.mp4', '.mov', '.m4v', '.mkv', '.webm', '.y4m', '.yuv', '.m3u8'];

export interface ValidationResult {
  valid: boolean;
  errorKey?: 'unsupportedFormat' | 'fileTooLarge';
}

export function validateCMAFFile(file: File): ValidationResult {
  const filename = file.name.toLowerCase();
  const extension = filename.slice(filename.lastIndexOf('.'));

  if (!SUPPORTED_FORMATS.includes(extension)) {
    return {
      valid: false,
      errorKey: 'unsupportedFormat',
    };
  }

  const maxSize = getMaxFileSizeBytes();
  if (file.size > maxSize) {
    return {
      valid: false,
      errorKey: 'fileTooLarge',
    };
  }

  return { valid: true };
}
