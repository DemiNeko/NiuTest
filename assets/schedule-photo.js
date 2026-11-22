// Images stay separate from the encrypted text plan and are addressed by content.
const maxInputBytes = 12 * 1024 * 1024;
export const maxPhotoBytes = 300 * 1024;
const maxPixels = 50_000_000;
const maxSide = 1600;

const photoError = code => Object.assign(new Error(code), { code });

function imageType(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return '';
}

export function toBase64(bytes) {
  let text = '';
  for (let start = 0; start < bytes.length; start += 8192) {
    text += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(text);
}

export async function photoPath(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length <= 12 || bytes.length > maxPhotoBytes ||
      imageType(bytes) !== 'image/webp') throw photoError('invalid');
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = Array.from(hash, n => n.toString(16).padStart(2, '0')).join('');
  return './src/images/schedule/' + hex + '.webp';
}

async function encodePhoto(image) {
  const width = image.naturalWidth, height = image.naturalHeight;
  if (!width || !height) throw photoError('photo-decode');
  if (width * height > maxPixels) throw photoError('photo-size');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw photoError('photo-decode');
  let scale = Math.min(1, maxSide / Math.max(width, height));
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const quality = attempt === 0 ? .82 : .72;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob || blob.type !== 'image/webp') throw photoError('photo-decode');
      if (blob.size <= maxPhotoBytes) return new Uint8Array(await blob.arrayBuffer());
      scale *= .72;
    }
    throw photoError('photo-size');
  } finally { canvas.width = canvas.height = 0; }
}

export async function prepareSchedulePhoto(file) {
  if (!(file instanceof Blob) || !file.size) throw photoError('photo-type');
  if (file.size > maxInputBytes) throw photoError('photo-size');
  const type = imageType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  if (!type || (file.type && type !== file.type)) throw photoError('photo-type');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(photoError('photo-decode'));
      image.src = url;
    });
    const bytes = await encodePhoto(image);
    return { path: await photoPath(bytes), bytes, previewUrl: 'data:image/webp;base64,' + toBase64(bytes) };
  } finally { URL.revokeObjectURL(url); }
}
