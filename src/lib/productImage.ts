const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxSourceBytes = 15 * 1024 * 1024;
const maxUploadBytes = 1_900_000; // the server accepts up to 2 MB
const maxDimension = 1600;

const canvasToDataUrl = (canvas: HTMLCanvasElement, quality: number) => canvas.toDataURL('image/jpeg', quality);
const dataUrlBytes = (dataUrl: string) => Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

/**
 * Turns a picked file into a JPEG data URL that fits the server's 2 MB limit.
 * Phone photos are usually 3-8 MB, so large pictures are scaled down and re-compressed here.
 */
export async function prepareProductImage(file: File): Promise<string> {
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Choose a JPG, PNG or WebP image.');
  }
  if (file.size > maxSourceBytes) {
    throw new Error('That image is larger than 15 MB. Choose a smaller one.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not process this image.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.88, 0.75, 0.6]) {
        const dataUrl = canvasToDataUrl(canvas, quality);
        if (dataUrlBytes(dataUrl) <= maxUploadBytes) return dataUrl;
      }
      scale *= 0.75;
    }
    throw new Error('Could not shrink this image enough. Try a smaller picture.');
  } finally {
    bitmap.close();
  }
}
