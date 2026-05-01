# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: streaming.spec.ts >> Streaming Platform E2E Tests >> should perform a full video upload and playback flow with scroll and long playback
- Location: tests/e2e/streaming.spec.ts:5:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.setInputFiles: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="file"]')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - img [ref=e5]
    - generic "Biblioteca" [ref=e7]:
      - img [ref=e8]
    - generic "Upload" [ref=e11]:
      - img [ref=e12]
    - generic "Dashboard" [ref=e15]:
      - img [ref=e16]
    - generic "Configurações" [ref=e21]:
      - img [ref=e22]
  - generic [ref=e25]:
    - generic [ref=e26]:
      - generic [ref=e27]: BibliotecaLOADING
      - generic [ref=e28]: Loading session...
    - generic [ref=e29]:
      - generic [ref=e30]:
        - paragraph [ref=e31]: Secure access
        - heading "Google sign-in protects uploads, edits, and downloads." [level=1] [ref=e32]
        - paragraph [ref=e33]: Members can browse and download. Admins can upload, rename, and delete videos. The server enforces the boundary either way.
        - button "Sign in with Google" [ref=e35]
      - generic [ref=e37]:
        - paragraph [ref=e38]: Loading session
        - heading "Checking access" [level=3] [ref=e39]
        - paragraph [ref=e40]: Preparing role-aware upload controls.
      - generic [ref=e41]: Vídeos
      - paragraph [ref=e43]: Loading session...
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import path from 'path';
  3  | 
  4  | test.describe('Streaming Platform E2E Tests', () => {
  5  |   test('should perform a full video upload and playback flow with scroll and long playback', async ({ page }) => {
  6  |     // 1. Visualização da tela inicial
  7  |     await page.goto('/');
  8  |     await page.screenshot({ path: 'test-results/screenshots/01-home-page.png' });
  9  |     await expect(page).toHaveTitle(/Streaming Platform Upload/);
  10 | 
  11 |     // Adiciona um scroll inicial para mostrar o movimento
  12 |     await page.mouse.wheel(0, 300);
  13 |     await page.waitForTimeout(500);
  14 |     await page.screenshot({ path: 'test-results/screenshots/01b-home-scrolled.png' });
  15 |     await page.mouse.wheel(0, -300); // Volta pro topo
  16 | 
  17 |     // 2. Upload de video
  18 |     const filePath = path.resolve(__dirname, '../../test-video.mp4');
  19 |     
  20 |     // Antes do upload
  21 |     await page.screenshot({ path: 'test-results/screenshots/02-before-upload.png' });
  22 |     
  23 |     // Seleciona o arquivo diretamente no input
> 24 |     await page.setInputFiles('input[type="file"]', filePath);
     |     ^ Error: page.setInputFiles: Test timeout of 30000ms exceeded.
  25 |     
  26 |     // 3. Status do video upload (processando e pronto)
  27 |     // Verifica presença do card de upload na área de uploads
  28 |     const uploadCard = page.locator('div[class*="uploadCard"]').filter({ hasText: 'test-video.mp4' });
  29 |     await expect(uploadCard).toBeVisible();
  30 |     await page.screenshot({ path: 'test-results/screenshots/03-upload-started.png' });
  31 | 
  32 |     // Aguarda o status mudar para "Pronto"
  33 |     await expect(uploadCard.locator('text=Pronto')).toBeVisible({ timeout: 30000 });
  34 |     await page.screenshot({ path: 'test-results/screenshots/04-upload-ready.png' });
  35 | 
  36 |     // 4. Visualização da tela com todos os videos na biblioteca
  37 |     // O vídeo deve aparecer na lista VideoList (grid)
  38 |     const libraryGrid = page.locator('div[class*="grid"]');
  39 |     
  40 |     // Scrola até o grid de vídeos
  41 |     await libraryGrid.scrollIntoViewIfNeeded();
  42 |     await page.waitForTimeout(500);
  43 |     await page.screenshot({ path: 'test-results/screenshots/04b-scrolled-to-grid.png' });
  44 | 
  45 |     await expect(libraryGrid).toContainText('test-video.mp4', { timeout: 10000 });
  46 |     
  47 |     const videoCard = libraryGrid.locator('div[class*="card"]').filter({ hasText: 'test-video.mp4' }).first();
  48 |     await expect(videoCard).toBeVisible();
  49 |     await page.screenshot({ path: 'test-results/screenshots/05-video-list.png' });
  50 | 
  51 |     // 5. Busca
  52 |     const searchInput = page.getByPlaceholder('Search your videos...');
  53 |     await searchInput.fill('test-video');
  54 |     await page.waitForTimeout(1000); 
  55 |     await page.screenshot({ path: 'test-results/screenshots/06-search-action.png' });
  56 |     
  57 |     await expect(libraryGrid.locator('text=test-video.mp4').first()).toBeVisible();
  58 |     
  59 |     // Busca algo que não existe
  60 |     await searchInput.fill('non-existent-video-xyz-999');
  61 |     await page.waitForTimeout(1000);
  62 |     await expect(libraryGrid.locator('text=test-video.mp4')).not.toBeVisible();
  63 |     await page.screenshot({ path: 'test-results/screenshots/07-search-empty.png' });
  64 |     
  65 |     // Limpa busca
  66 |     await searchInput.fill('');
  67 |     await page.waitForTimeout(1000);
  68 |     await expect(libraryGrid.locator('text=test-video.mp4').first()).toBeVisible();
  69 | 
  70 |     // 6. Thumbnail
  71 |     const thumbnail = videoCard.locator('img');
  72 |     await expect(thumbnail).toBeVisible();
  73 |     await page.screenshot({ path: 'test-results/screenshots/08-thumbnail-check.png' });
  74 | 
  75 |     // 7. Visualização do video (Playback)
  76 |     await videoCard.click();
  77 |     
  78 |     const videoPlayer = page.locator('video');
  79 |     await expect(videoPlayer).toBeVisible();
  80 |     
  81 |     // Adiciona espera de 10 segundos para mostrar o vídeo reproduzindo
  82 |     console.log("Aguardando 10 segundos de reprodução do vídeo...");
  83 |     await page.screenshot({ path: 'test-results/screenshots/09-video-playback-start.png' });
  84 |     
  85 |     // Espera 10 segundos e tira screenshots periódicos
  86 |     for (let i = 1; i <= 5; i++) {
  87 |         await page.waitForTimeout(2000);
  88 |         await page.screenshot({ path: `test-results/screenshots/09-video-playback-${i*2}s.png` });
  89 |     }
  90 |     
  91 |     // Fecha o modal
  92 |     await page.getByLabel('Close video player').click();
  93 |     await expect(videoPlayer).not.toBeVisible();
  94 |     await page.screenshot({ path: 'test-results/screenshots/10-video-modal-closed.png' });
  95 |   });
  96 | });
  97 | 
```