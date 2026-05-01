import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Streaming Platform E2E Tests', () => {
  test('should perform a full video upload and playback flow with scroll and long playback', async ({ page }) => {
    test.setTimeout(90_000);

    // 1. Visualização da tela inicial
    await page.goto('/');
    await page.screenshot({ path: 'test-results/screenshots/01-home-page.png' });
    await expect(page).toHaveTitle(/Streaming Platform Upload/);
    await page.getByRole('button', { name: /sign in as e2e admin/i }).first().click();
    await expect(page.getByText('admin-e2e@example.com')).toBeVisible();

    // Adiciona um scroll inicial para mostrar o movimento
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/01b-home-scrolled.png' });
    await page.mouse.wheel(0, -300); // Volta pro topo

    // 2. Upload de video
    const filePath = path.resolve(__dirname, '../../test-video.mp4');
    
    // Antes do upload
    await page.screenshot({ path: 'test-results/screenshots/02-before-upload.png' });
    
    // Seleciona o arquivo diretamente no input
    await page.setInputFiles('input[type="file"]', filePath);
    
    // 3. Status do video upload (processando e pronto)
    // Verifica presença do card de upload na área de uploads
    const uploadCard = page.locator('div[class*="uploadCard"]').filter({ hasText: 'test-video.mp4' });
    await expect(uploadCard).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/03-upload-started.png' });

    // Aguarda o status mudar para "Pronto"
    await expect(uploadCard.locator('text=Pronto')).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: 'test-results/screenshots/04-upload-ready.png' });

    // 4. Visualização da tela com todos os videos na biblioteca
    // O vídeo deve aparecer na lista VideoList (grid)
    const libraryGrid = page.locator('div[class*="grid"]');
    
    // Scrola até o grid de vídeos
    await libraryGrid.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/04b-scrolled-to-grid.png' });

    await expect(libraryGrid).toContainText('test-video.mp4', { timeout: 10000 });
    
    const videoCard = libraryGrid.locator('div[class*="card"]').filter({ hasText: 'test-video.mp4' }).first();
    await expect(videoCard).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/05-video-list.png' });

    // 5. Busca
    const searchInput = page.getByPlaceholder('Search your videos...');
    await searchInput.fill('test-video');
    await page.waitForTimeout(1000); 
    await page.screenshot({ path: 'test-results/screenshots/06-search-action.png' });
    
    await expect(libraryGrid.locator('text=test-video.mp4').first()).toBeVisible();
    
    // Busca algo que não existe
    await searchInput.fill('non-existent-video-xyz-999');
    await page.waitForTimeout(1000);
    await expect(libraryGrid.locator('text=test-video.mp4')).not.toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/07-search-empty.png' });
    
    // Limpa busca
    await searchInput.fill('');
    await page.waitForTimeout(1000);
    await expect(libraryGrid.locator('text=test-video.mp4').first()).toBeVisible();

    // 6. Thumbnail
    const thumbnail = videoCard.locator('img');
    await expect(thumbnail).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/08-thumbnail-check.png' });

    // 7. Visualização do video (Playback)
    await videoCard.click();
    
    const videoPlayer = page.locator('video');
    await expect(videoPlayer).toBeVisible();
    
    // Adiciona espera de 10 segundos para mostrar o vídeo reproduzindo
    console.log("Aguardando 10 segundos de reprodução do vídeo...");
    await page.screenshot({ path: 'test-results/screenshots/09-video-playback-start.png' });
    
    // Espera 10 segundos e tira screenshots periódicos
    for (let i = 1; i <= 5; i++) {
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `test-results/screenshots/09-video-playback-${i*2}s.png` });
    }
    
    // Fecha o modal
    await page.getByLabel('Close video player').click();
    await expect(videoPlayer).not.toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/10-video-modal-closed.png' });

    // 8. Download do vídeo via fluxo autenticado
    await videoCard.click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: /^download$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBeTruthy();
    expect(await download.path()).toBeTruthy();
    await page.screenshot({ path: 'test-results/screenshots/11-download-validated.png' });
  });
});
