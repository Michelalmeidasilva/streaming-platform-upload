const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const client = new S3Client({
  region: 'us-east-1',
  endpoint: 'http://localhost:9000',
  forcePathStyle: true,
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin'
  }
});

async function main() {
  const command = new ListObjectsV2Command({ Bucket: 'videos' });
  const url = await getSignedUrl(client, command, { expiresIn: 3600 });
  console.log(`curl -s "${url}"`);
}

main().catch(console.error);
