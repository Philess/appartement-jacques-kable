import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import manifest from './photos.json';

const sources = import.meta.glob<ImageMetadata>('../assets/photos/*.jpg', { eager: true, import: 'default' });
export const photos = await Promise.all(manifest.map(async (entry) => {
  const source = sources[`../assets/photos/${entry.file}`];
  if (!source) throw new Error(`Photographie absente : ${entry.file}`);
  const full = await getImage({ src: source, width: source.width, format: 'jpg', quality: 88 });
  return { ...entry, source, full: full.src };
}));
export type PropertyPhoto = typeof photos[number];
export function photo(id: number): PropertyPhoto {
  const value = photos.find((entry) => entry.id === id);
  if (!value) throw new Error(`Photographie inconnue : ${id}`);
  return value;
}
