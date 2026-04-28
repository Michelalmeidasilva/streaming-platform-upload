import sharp from 'sharp';
import { Video } from '@/types';

export class FallbackGenerator {
  private readonly WIDTH = 640;
  private readonly HEIGHT = 360;
  private readonly BACKGROUND_COLOR = '#1a1a1a';
  private readonly ACCENT_COLOR = '#00adef';
  private readonly TEXT_COLOR = '#ffffff';

  async generateFallback(video: Video): Promise<Buffer> {
    const svg = this.createSvg(video);
    const buffer = await sharp(Buffer.from(svg))
      .jpeg({ quality: 85 })
      .toBuffer();

    return buffer;
  }

  private createSvg(video: Video): string {
    const filename = this.truncateFilename(video.originalName || video.filename, 40);
    const uploadTime = video.createdAt.toLocaleDateString();

    const svg = `
      <svg width="${this.WIDTH}" height="${this.HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#262626;stop-opacity:1" />
          </linearGradient>
        </defs>

        <rect width="${this.WIDTH}" height="${this.HEIGHT}" fill="url(#grad)" />

        <g transform="translate(${this.WIDTH / 2}, ${this.HEIGHT / 2 - 40})">
          <circle cx="0" cy="0" r="30" fill="${this.ACCENT_COLOR}" opacity="0.2" />
          <polygon points="0,-12 20,8 -20,8" fill="${this.ACCENT_COLOR}" />
        </g>

        <text
          x="${this.WIDTH / 2}"
          y="${this.HEIGHT / 2 + 30}"
          font-family="Inter, Arial, sans-serif"
          font-size="16"
          font-weight="bold"
          fill="${this.TEXT_COLOR}"
          text-anchor="middle"
        >
          ${this.escapeXml(filename)}
        </text>

        <text
          x="${this.WIDTH / 2}"
          y="${this.HEIGHT / 2 + 55}"
          font-family="Inter, Arial, sans-serif"
          font-size="12"
          fill="#a0a0a0"
          text-anchor="middle"
        >
          Uploaded ${uploadTime}
        </text>
      </svg>
    `;

    return svg.trim();
  }

  private truncateFilename(filename: string, maxLength: number): string {
    if (filename.length <= maxLength) {
      return filename;
    }

    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) {
      return filename.substring(0, maxLength - 3) + '...';
    }

    const name = filename.substring(0, lastDot);
    const ext = filename.substring(lastDot);

    const availableLength = maxLength - ext.length - 3;
    return name.substring(0, availableLength) + '...' + ext;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
