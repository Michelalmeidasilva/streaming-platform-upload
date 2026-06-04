# Thumbnail public URL (browser-reachable object URLs)

## Motivação

Com o app rodando em container Docker, o thumbnail não aparecia na UI. O
`video.thumbnailUrl` era gerado por `MinIOAdapter.upload()` → `getSignedUrl()` →
`presignedGetObject`, e o client MinIO é construído com o `MINIO_ENDPOINT` do
container (`http://minio:9000`). Resultado:

```
http://minio:9000/videos/thumbnails/<id>.jpg?X-Amz-Signature=...
```

Esse URL é renderizado direto no browser (`<Image src={video.thumbnailUrl}>` em
`VideoList.tsx`). O browser roda no **host** e não resolve o hostname Docker
`minio` → imagem quebrada. Agravante: por ser uma presigned URL, **expira** pelo
TTL, então mesmo via proxy quebraria depois de um tempo.

É a mesma classe do bug de upload (host interno vs. host do browser), na direção
oposta: operações server→MinIO precisam de `minio:9000`, mas URLs entregues ao
browser precisam de `localhost:9000`.

## Decisão de design

Introduzir o conceito de **endpoint público** (espelhando o `CDN_BASE` do
`streaming-distribution`), separado do endpoint interno usado nas operações S3.

- Nova env `MINIO_PUBLIC_ENDPOINT` (default = `MINIO_ENDPOINT` ou
  `http://localhost:9000`).
- Novo método na interface: `IStorageAdapter.getPublicUrl(key): Promise<string>`.
  - **MinIO**: retorna URL **path-style não-assinada** —
    `${publicEndpoint}/${bucket}/${key}`. Sem assinatura e sem host interno;
    depende do bucket `videos` ser *public-read* (mesmo modelo do distribution).
  - **S3**: delega a `getSignedUrl` (o host AWS já é alcançável pelo browser).
  - **Memory**: delega a `getSignedUrl`.
- `thumbnailUrl` passa a vir de `getPublicUrl(thumbnailKey)` em vez do retorno de
  `upload()`, tanto no caminho client-provided (`UploadService.completeUpload`)
  quanto no server-side (`ThumbnailExtractor`: frame real e fallback).

Apenas o `thumbnailUrl` é um URL de storage cru entregue ao browser; downloads e
playback passam pelo proxy `/api/videos/:id/download` (consumido server-side),
então não eram afetados.

## Contrato / configuração

| Cenário | `MINIO_ENDPOINT` | `MINIO_PUBLIC_ENDPOINT` |
|---|---|---|
| Host (`npm run dev`) | `http://localhost:9000` | `http://localhost:9000` (fallback) |
| Container (compose) | `http://minio:9000` | `http://localhost:9000` (override no compose) |

O override em `infra/docker-compose.yml` (bloco `environment:` do
`streaming-platform-upload`) é obrigatório no modo container — sem ele,
`publicEndpoint` cairia em `minio:9000` e o bug voltaria.

## Caveats

- Depende do bucket `videos` ser **public-read**. Se a política mudar para
  privado, `getPublicUrl` do MinIO precisaria voltar a assinar (com o host
  público) ou servir via proxy.
- `ffmpeg` **não** está instalado na imagem; a extração server-side de frame cai
  no `FallbackGenerator` (imagem placeholder). Frames reais vêm do thumbnail
  gerado no client (canvas). Decisão atual: manter só o fallback.
- Para S3 em produção, `getPublicUrl` retorna presigned (expira). Se objetos não
  forem públicos, isso é aceitável para thumbnails de curta vida; reavaliar se
  precisar de URLs persistentes.
