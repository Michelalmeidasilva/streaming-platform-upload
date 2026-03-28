const SUPPORTED_FORMATS = ['.mp4', '.mov', '.m4v', '.webm', '.m3u8'];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateCMAFFile(file: File): ValidationResult {
  const filename = file.name.toLowerCase();
  const extension = filename.slice(filename.lastIndexOf('.'));

  if (!SUPPORTED_FORMATS.includes(extension)) {
    return {
      valid: false,
      error: `Unsupported format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`,
    };
  }

  const maxSize = 5 * 1024 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 5GB limit',
    };
  }

  return { valid: true };
}
