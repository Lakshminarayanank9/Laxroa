import { createHash } from 'node:crypto';
import { env } from '../config/env.js';

export async function uploadProductImage(buffer, mimeType, fileName) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'laxroa/products';
  const signatureBase = `folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
  const signature = createHash('sha1').update(signatureBase).digest('hex');
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), fileName);
  form.append('api_key', env.CLOUDINARY_API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/upload`,
    { method: 'POST', body: form, signal: AbortSignal.timeout(20000) }
  );
  const result = await response.json();

  if (!response.ok || !result.secure_url || !result.public_id) {
    const error = new Error(result.error?.message || 'Image upload failed.');
    error.status = 502;
    throw error;
  }

  return { url: result.secure_url, publicId: result.public_id };
}
