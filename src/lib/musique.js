import { getSupabaseClient } from './supabase.js';

const BUCKET = 'musique';
export const MUSIC_MAX_BYTES = 20 * 1024 * 1024;
export const MUSIC_TITLE_MAX = 120;

// Formats lus partout, iPhone compris ; l'extension sert de repli si le type est vide.
const EXTENSIONS = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
};
const CONTENT_TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac' };

function publicUrl(storagePath) {
  return getSupabaseClient().storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export function musicExtension(file) {
  const fromType = EXTENSIONS[file.type];
  if (fromType) return fromType;
  const fromName = file.name.split('.').pop()?.toLowerCase();
  return fromName in CONTENT_TYPES ? fromName : null;
}

// Morceau joué sur le site, ou null.
export async function loadActiveMusic() {
  const { data, error } = await getSupabaseClient()
    .from('musiques')
    .select('titre, storage_path')
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  return data ? { title: data.titre, url: publicUrl(data.storage_path) } : null;
}

export async function listMusic() {
  const { data, error } = await getSupabaseClient()
    .from('musiques')
    .select('id, titre, storage_path, active, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((track) => ({ ...track, url: publicUrl(track.storage_path) }));
}

export async function uploadMusic(file, title) {
  const extension = musicExtension(file);
  if (!extension) throw new Error('Format non pris en charge.');
  const storagePath = `piste-${Date.now()}.${extension}`;
  const client = getSupabaseClient();
  const { error } = await client.storage.from(BUCKET).upload(storagePath, file, {
    contentType: CONTENT_TYPES[extension],
    cacheControl: '31536000',
  });
  if (error) throw error;

  const { data: id, error: rpcError } = await client.rpc('admin_add_music', {
    p_titre: title,
    p_storage_path: storagePath,
  });
  if (rpcError) {
    await client.storage.from(BUCKET).remove([storagePath]);
    throw rpcError;
  }
  return id;
}

export async function selectMusic(id) {
  const { error } = await getSupabaseClient().rpc('admin_select_music', { p_id: id });
  if (error) throw error;
}

export async function renameMusic(id, title) {
  const { error } = await getSupabaseClient().rpc('admin_rename_music', {
    p_id: id,
    p_titre: title,
  });
  if (error) throw error;
}

export async function deleteMusic(id) {
  const client = getSupabaseClient();
  const { data: storagePath, error } = await client.rpc('admin_delete_music', { p_id: id });
  if (error) throw error;
  if (storagePath) {
    const { error: removeError } = await client.storage.from(BUCKET).remove([storagePath]);
    if (removeError) console.warn('Fichier audio non supprimé du stockage.', removeError);
  }
}
