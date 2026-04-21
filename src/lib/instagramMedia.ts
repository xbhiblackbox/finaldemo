import type { InstaReel } from "@/lib/instagramApi";

const PLAYABLE_VIDEO_RE = /\.(mp4|webm|mov|m4v|ogg|m3u8)(\?|$)/i;

export function isPlayableVideoUrl(url?: string | null): boolean {
  return Boolean(url && url.length > 5);
}

export function getPlayableVideoUrl(...urls: Array<string | undefined | null>): string {
  return urls.find((url) => isPlayableVideoUrl(url)) || "";
}

export function getIgMediaByCode(
  media: InstaReel[],
  igCode: string,
  fallbackIndex: number,
): InstaReel | null {
  if (igCode) {
    const exact = media.find((item) => item.code === igCode);
    if (exact) return exact;
  }

  return media[fallbackIndex] || null;
}