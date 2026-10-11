/**
 * Utility functions for handling image URLs, extracting direct links from search redirects
 * (like Google Images), and providing reliable fallbacks.
 */

export const DEFAULT_SPACE_IMAGE = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1000&q=80';
export const DEFAULT_SERVICE_IMAGE = 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=80';

/**
 * Parses user input to extract direct image URLs if they pasted a search redirect link
 * (e.g., Google Images "https://www.google.com/imgres?imgurl=https%3A%2F%2F...").
 */
export function cleanImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim().replace(/^["']|["']$/g, '');

  // Extract from Google Images
  if (trimmed.includes('google.com/imgres') || trimmed.includes('/imgres?')) {
    try {
      const parsed = new URL(trimmed);
      const direct = parsed.searchParams.get('imgurl');
      if (direct) {
        return decodeURIComponent(direct);
      }
    } catch {
      const match = trimmed.match(/[?&]imgurl=([^&]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
  }

  // Extract from Bing Images
  if (trimmed.includes('bing.com/images') && trimmed.includes('mediaurl=')) {
    const match = trimmed.match(/[?&]mediaurl=([^&]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return trimmed;
}

/**
 * Handles image rendering failure by smoothly substituting the fallback image
 * preventing broken icon displays.
 */
export function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackUrl: string = DEFAULT_SPACE_IMAGE
) {
  const target = e.currentTarget;
  if (target.src !== fallbackUrl) {
    target.onerror = null; // Prevent infinite error loops if fallback fails
    target.src = fallbackUrl;
  }
}
