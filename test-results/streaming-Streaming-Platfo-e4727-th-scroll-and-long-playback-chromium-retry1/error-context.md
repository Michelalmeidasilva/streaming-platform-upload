# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: streaming.spec.ts >> Streaming Platform E2E Tests >> should perform a full video upload and playback flow with scroll and long playback
- Location: tests/e2e/streaming.spec.ts:5:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('div[class*="uploadCard"]').filter({ hasText: 'test-video.mp4' }).locator('text=Pronto')
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for locator('div[class*="uploadCard"]').filter({ hasText: 'test-video.mp4' }).locator('text=Pronto')

```

```
Error: apiRequestContext._wrapApiCall: ENOENT: no such file or directory, open '/Users/user/workspace-personal/video-on-demand-arch/microsservices/streaming-platform-upload/test-results/.playwright-artifacts-1/traces/eb8dbd7e6b4f7b40e877-558af9c031231680c21e-retry1.trace'
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - navigation [ref=e3]:
      - img [ref=e5]
      - generic "Biblioteca" [ref=e7] [cursor=pointer]:
        - img [ref=e8]
      - generic "Upload" [ref=e11] [cursor=pointer]:
        - img [ref=e12]
      - generic "Dashboard" [ref=e15] [cursor=pointer]:
        - img [ref=e16]
      - generic "Configurações" [ref=e21] [cursor=pointer]:
        - img [ref=e22]
    - generic [ref=e25]:
      - generic [ref=e26]:
        - generic [ref=e27]:
          - generic [ref=e28]: Biblioteca
          - generic [ref=e29]: ADMIN
        - generic [ref=e30]:
          - generic [ref=e31]: E2E Admin
          - button "Sign out" [ref=e32] [cursor=pointer]
      - generic [ref=e33]:
        - generic [ref=e34]:
          - generic [ref=e35]:
            - paragraph [ref=e36]: Session
            - paragraph [ref=e37]: admin-e2e@example.com
          - generic [ref=e38]:
            - paragraph [ref=e39]: Role
            - paragraph [ref=e40]: ADMIN
          - generic [ref=e41]:
            - paragraph [ref=e42]: Capabilities
            - paragraph [ref=e43]: Upload, edit, delete, view, search, download
        - generic [ref=e44]:
          - generic [ref=e46] [cursor=pointer]:
            - img [ref=e48]
            - generic [ref=e51]:
              - heading "Arraste arquivos de vídeo aqui" [level=3] [ref=e52]
              - paragraph [ref=e53]: ou clique para selecionar
            - generic [ref=e54]:
              - generic [ref=e55]: MP4
              - generic [ref=e56]: MOV
              - generic [ref=e57]: M4V
              - generic [ref=e58]: WEBM
          - generic [ref=e60]:
            - img [ref=e62]
            - paragraph [ref=e65]: test-video.mp4
            - generic [ref=e67]:
              - generic [ref=e68]: Erro
              - button "Remover" [ref=e69] [cursor=pointer]:
                - img [ref=e70]
        - generic [ref=e73]: Vídeos
        - generic [ref=e75]:
          - generic [ref=e77]:
            - generic:
              - img
            - textbox "Search your videos..." [ref=e78]
          - generic [ref=e79]:
            - img [ref=e81]
            - heading "Nenhum vídeo ainda" [level=3] [ref=e84]
            - paragraph [ref=e85]: Importe seu primeiro arquivo para começar
  - alert [ref=e86]
```