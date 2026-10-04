const maxSourceBytes = 2 * 1024 * 1024;
const maxImageDimension = 512;

export async function prepareProfileImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > maxSourceBytes) {
    throw new Error('Choose a JPG or PNG image smaller than 2 MB.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxImageDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not process this profile image.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    bitmap.close();
  }
}