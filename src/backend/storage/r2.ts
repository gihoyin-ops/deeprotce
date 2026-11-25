import crypto from 'node:crypto';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export const getR2Config = (): R2Config | null => {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || '';
  const bucketName = process.env.R2_BUCKET_NAME?.trim() || '';
  const publicUrl = (process.env.R2_PUBLIC_URL?.trim() || 'https://cdn.deepsia.my.id').replace(/\/+$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
};

export const isR2Configured = (): boolean => getR2Config() !== null;

const sha256Hex = (data: string | Uint8Array): string =>
  crypto.createHash('sha256').update(data).digest('hex');

const hmacSha256 = (key: string | Buffer, data: string): Buffer =>
  crypto.createHmac('sha256', key).update(data, 'utf8').digest();

const encodeS3Key = (key: string): string =>
  key
    .replace(/^\/+/, '')
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

const signR2Request = ({
  config,
  method,
  objectKey,
  payloadHash,
  contentType
}: {
  config: R2Config;
  method: 'PUT' | 'DELETE';
  objectKey: string;
  payloadHash: string;
  contentType?: string;
}) => {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';

  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${config.bucketName}/${encodeS3Key(objectKey)}`;
  const endpoint = `https://${host}${canonicalUri}`;

  const headersToSign: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  };
  if (contentType) {
    headersToSign['content-type'] = contentType;
  }

  const sortedKeys = Object.keys(headersToSign).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${headersToSign[k]}\n`).join('');
  const signedHeaders = sortedKeys.join(';');

  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    endpoint,
    headers: {
      ...headersToSign,
      authorization
    }
  };
};

export const uploadToR2 = async ({
  key,
  body,
  contentType
}: {
  key: string;
  body: Uint8Array;
  contentType: string;
}): Promise<{ key: string; url: string }> => {
  const config = getR2Config();
  if (!config) {
    throw new Error('Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.');
  }

  const cleanKey = key.replace(/^\/+/, '');
  const payloadHash = sha256Hex(body);
  const signed = signR2Request({
    config,
    method: 'PUT',
    objectKey: cleanKey,
    payloadHash,
    contentType
  });

  const res = await fetch(signed.endpoint, {
    method: 'PUT',
    headers: signed.headers,
    body: Buffer.from(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`R2 upload failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  return {
    key: cleanKey,
    url: `${config.publicUrl}/${encodeS3Key(cleanKey)}`
  };
};

export const deleteFromR2 = async (key: string): Promise<void> => {
  const config = getR2Config();
  if (!config) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const cleanKey = key.replace(/^\/+/, '');
  const signed = signR2Request({
    config,
    method: 'DELETE',
    objectKey: cleanKey,
    payloadHash: sha256Hex('')
  });

  const res = await fetch(signed.endpoint, {
    method: 'DELETE',
    headers: signed.headers
  });

  if (!res.ok && res.status !== 404) {
    const errText = await res.text().catch(() => '');
    throw new Error(`R2 delete failed (${res.status}): ${errText.slice(0, 200)}`);
  }
};
