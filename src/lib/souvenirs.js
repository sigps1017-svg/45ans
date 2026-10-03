import { getSupabaseClient } from './supabase.js';

const BUCKET = 'souvenirs';
const MAX_PHOTO_SIDE = 1600;
export const CAPTION_MAX = 80;

function publicUrl(storagePath) {
  return getSupabaseClient().storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

// Fusionne les souvenirs de src/config.js avec ceux enregistrés par les admins.
// Chaque face indique sa source : 'default' (config), 'custom' (bucket) ou 'empty'.
export async function loadSouvenirFaces(defaults) {
  const client = getSupabaseClient();
  const [textResult, photoResult] = await Promise.all([
    client.from('souvenirs').select('cube_index, year, caption'),
    client.from('souvenir_photos').select('cube_index, face_index, storage_path'),
  ]);
  if (textResult.error) throw textResult.error;
  if (photoResult.error) throw photoResult.error;

  const texts = new Map(textResult.data.map((row) => [row.cube_index, row]));
  const photos = new Map(
    photoResult.data.map((row) => [`${row.cube_index}:${row.face_index}`, row]),
  );

  return defaults.map((memory, cubeIndex) => ({
    year: texts.get(cubeIndex)?.year ?? memory.year,
    caption: texts.get(cubeIndex)?.caption ?? memory.caption,
    faces: memory.photos.map((defaultPhoto, faceIndex) => {
      const row = photos.get(`${cubeIndex}:${faceIndex}`);
      if (!row) {
        return { source: defaultPhoto ? 'default' : 'empty', url: defaultPhoto, storagePath: null };
      }
      if (!row.storage_path) return { source: 'empty', url: null, storagePath: null };
      return { source: 'custom', url: publicUrl(row.storage_path), storagePath: row.storage_path };
    }),
  }));
}

// Forme attendue par les scènes : { year, caption, photos: [6 URL ou null] }.
export async function loadMemories(defaults) {
  const cubes = await loadSouvenirFaces(defaults);
  return cubes.map(({ year, caption, faces }) => ({
    year,
    caption,
    photos: faces.map((face) => face.url),
  }));
}

export async function saveSouvenirText(cubeIndex, year, caption) {
  const { error } = await getSupabaseClient().rpc('admin_save_souvenir', {
    p_cube_index: cubeIndex,
    p_year: year,
    p_caption: caption,
  });
  if (error) throw error;
}

async function loadImage(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Repli sur <img> si le format n'est pas pris en charge par createImageBitmap.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Réduit la photo (côté le plus long à 1600 px) et la convertit en JPEG.
async function prepareJpeg(file) {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de préparer la photo.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Impossible de convertir la photo en JPEG.');
  return blob;
}

async function removeStoredPhoto(storagePath) {
  if (!storagePath) return;
  const { error } = await getSupabaseClient().storage.from(BUCKET).remove([storagePath]);
  // L'ancien fichier orphelin n'empêche pas l'affichage : on le signale seulement.
  if (error) console.warn('Ancienne photo non supprimée du stockage.', error);
}

async function setFacePhoto(cubeIndex, faceIndex, storagePath) {
  const { error } = await getSupabaseClient().rpc('admin_set_souvenir_photo', {
    p_cube_index: cubeIndex,
    p_face_index: faceIndex,
    p_storage_path: storagePath,
  });
  if (error) throw error;
}

export async function uploadFacePhoto(cubeIndex, faceIndex, file, previousPath) {
  const blob = await prepareJpeg(file);
  const storagePath = `cube-${cubeIndex}/face-${faceIndex}-${Date.now()}.jpg`;
  const { error } = await getSupabaseClient()
    .storage.from(BUCKET)
    .upload(storagePath, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;

  try {
    await setFacePhoto(cubeIndex, faceIndex, storagePath);
  } catch (setError) {
    await removeStoredPhoto(storagePath);
    throw setError;
  }
  await removeStoredPhoto(previousPath);
}

export async function clearFacePhoto(cubeIndex, faceIndex, previousPath) {
  await setFacePhoto(cubeIndex, faceIndex, null);
  await removeStoredPhoto(previousPath);
}

export async function resetFacePhoto(cubeIndex, faceIndex, previousPath) {
  const { error } = await getSupabaseClient().rpc('admin_reset_souvenir_photo', {
    p_cube_index: cubeIndex,
    p_face_index: faceIndex,
  });
  if (error) throw error;
  await removeStoredPhoto(previousPath);
}
