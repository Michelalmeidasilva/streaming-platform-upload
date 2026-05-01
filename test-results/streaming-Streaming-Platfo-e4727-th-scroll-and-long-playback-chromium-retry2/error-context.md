# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: streaming.spec.ts >> Streaming Platform E2E Tests >> should perform a full video upload and playback flow with scroll and long playback
- Location: tests/e2e/streaming.spec.ts:5:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/
Call log:
  - navigating to "http://127.0.0.1:3100/", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import path from 'path';
  3   | 
  4   | test.describe('Streaming Platform E2E Tests', () => {
  5   |   test('should perform a full video upload and playback flow with scroll and long playback', async ({ page }) => {
  6   |     test.setTimeout(90_000);
  7   | 
  8   |     // 1. Visualização da tela inicial
> 9   |     await page.goto('/');
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/
  10  |     await page.screenshot({ path: 'test-results/screenshots/01-home-page.png' });
  11  |     await expect(page).toHaveTitle(/Streaming Platform Upload/);
  12  |     await page.getByRole('button', { name: /sign in as e2e admin/i }).first().click();
  13  |     await expect(page.getByText('admin-e2e@example.com')).toBeVisible();
  14  | 
  15  |     // Adiciona um scroll inicial para mostrar o movimento
  16  |     await page.mouse.wheel(0, 300);
  17  |     await page.waitForTimeout(500);
  18  |     await page.screenshot({ path: 'test-results/screenshots/01b-home-scrolled.png' });
  19  |     await page.mouse.wheel(0, -300); // Volta pro topo
  20  | 
  21  |     // 2. Upload de video
  22  |     const filePath = path.resolve(__dirname, '../../test-video.mp4');
  23  |     
  24  |     // Antes do upload
  25  |     await page.screenshot({ path: 'test-results/screenshots/02-before-upload.png' });
  26  |     
  27  |     // Seleciona o arquivo diretamente no input
  28  |     await page.setInputFiles('input[type="file"]', filePath);
  29  |     
  30  |     // 3. Status do video upload (processando e pronto)
  31  |     // Verifica presença do card de upload na área de uploads
  32  |     const uploadCard = page.locator('div[class*="uploadCard"]').filter({ hasText: 'test-video.mp4' });
  33  |     await expect(uploadCard).toBeVisible();
  34  |     await page.screenshot({ path: 'test-results/screenshots/03-upload-started.png' });
  35  | 
  36  |     // Aguarda o status mudar para "Pronto"
  37  |     await expect(uploadCard.locator('text=Pronto')).toBeVisible({ timeout: 30000 });
  38  |     await page.screenshot({ path: 'test-results/screenshots/04-upload-ready.png' });
  39  | 
  40  |     // 4. Visualização da tela com todos os videos na biblioteca
  41  |     // O vídeo deve aparecer na lista VideoList (grid)
  42  |     const libraryGrid = page.locator('div[class*="grid"]');
  43  |     
  44  |     // Scrola até o grid de vídeos
  45  |     await libraryGrid.scrollIntoViewIfNeeded();
  46  |     await page.waitForTimeout(500);
  47  |     await page.screenshot({ path: 'test-results/screenshots/04b-scrolled-to-grid.png' });
  48  | 
  49  |     await expect(libraryGrid).toContainText('test-video.mp4', { timeout: 10000 });
  50  |     
  51  |     const videoCard = libraryGrid.locator('div[class*="card"]').filter({ hasText: 'test-video.mp4' }).first();
  52  |     await expect(videoCard).toBeVisible();
  53  |     await page.screenshot({ path: 'test-results/screenshots/05-video-list.png' });
  54  | 
  55  |     // 5. Busca
  56  |     const searchInput = page.getByPlaceholder('Search your videos...');
  57  |     await searchInput.fill('test-video');
  58  |     await page.waitForTimeout(1000); 
  59  |     await page.screenshot({ path: 'test-results/screenshots/06-search-action.png' });
  60  |     
  61  |     await expect(libraryGrid.locator('text=test-video.mp4').first()).toBeVisible();
  62  |     
  63  |     // Busca algo que não existe
  64  |     await searchInput.fill('non-existent-video-xyz-999');
  65  |     await page.waitForTimeout(1000);
  66  |     await expect(libraryGrid.locator('text=test-video.mp4')).not.toBeVisible();
  67  |     await page.screenshot({ path: 'test-results/screenshots/07-search-empty.png' });
  68  |     
  69  |     // Limpa busca
  70  |     await searchInput.fill('');
  71  |     await page.waitForTimeout(1000);
  72  |     await expect(libraryGrid.locator('text=test-video.mp4').first()).toBeVisible();
  73  | 
  74  |     // 6. Thumbnail
  75  |     const thumbnail = videoCard.locator('img');
  76  |     await expect(thumbnail).toBeVisible();
  77  |     await page.screenshot({ path: 'test-results/screenshots/08-thumbnail-check.png' });
  78  | 
  79  |     // 7. Visualização do video (Playback)
  80  |     await videoCard.click();
  81  |     
  82  |     const videoPlayer = page.locator('video');
  83  |     await expect(videoPlayer).toBeVisible();
  84  |     
  85  |     // Adiciona espera de 10 segundos para mostrar o vídeo reproduzindo
  86  |     console.log("Aguardando 10 segundos de reprodução do vídeo...");
  87  |     await page.screenshot({ path: 'test-results/screenshots/09-video-playback-start.png' });
  88  |     
  89  |     // Espera 10 segundos e tira screenshots periódicos
  90  |     for (let i = 1; i <= 5; i++) {
  91  |         await page.waitForTimeout(2000);
  92  |         await page.screenshot({ path: `test-results/screenshots/09-video-playback-${i*2}s.png` });
  93  |     }
  94  |     
  95  |     // Fecha o modal
  96  |     await page.getByLabel('Close video player').click();
  97  |     await expect(videoPlayer).not.toBeVisible();
  98  |     await page.screenshot({ path: 'test-results/screenshots/10-video-modal-closed.png' });
  99  | 
  100 |     // 8. Download do vídeo via fluxo autenticado
  101 |     await videoCard.click();
  102 |     const [download] = await Promise.all([
  103 |       page.waitForEvent('download'),
  104 |       page.getByRole('link', { name: /^download$/i }).click(),
  105 |     ]);
  106 |     expect(download.suggestedFilename()).toBeTruthy();
  107 |     expect(await download.path()).toBeTruthy();
  108 |     await page.screenshot({ path: 'test-results/screenshots/11-download-validated.png' });
  109 |   });
```