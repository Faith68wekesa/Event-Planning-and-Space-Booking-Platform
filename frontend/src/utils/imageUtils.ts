/**
 * Reliable utility functions for handling image URLs, extracting direct links from search redirects
 * (like Google Images, Google Drive), and providing high-definition category-specific fallbacks.
 */

export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  CATERING: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1000&q=80',
  DECORATION: 'https://images.unsplash.com/photo-1519225429980-715cb0215aed?auto=format&fit=crop&w=1000&q=80',
  PHOTOGRAPHY: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1000&q=80',
  ENTERTAINMENT: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1000&q=80',
  PLANNING: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=80',
  SOUND: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1000&q=80',
  WEDDING: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1000&q=80',
  CONFERENCE: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1000&q=80',
  BIRTHDAY: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1000&q=80',
  OUTDOOR: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80',
  PARTY: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1000&q=80',
  EXHIBITION: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1000&q=80',
};

export const DEFAULT_SPACE_IMAGE = CATEGORY_FALLBACK_IMAGES.WEDDING;
export const DEFAULT_SERVICE_IMAGE = CATEGORY_FALLBACK_IMAGES.DECORATION;

export function getCategoryFallback(category?: string, kind: 'VENUE' | 'SERVICE' = 'SERVICE'): string {
  if (category) {
    const key = category.toUpperCase().trim();
    if (CATEGORY_FALLBACK_IMAGES[key]) {
      return CATEGORY_FALLBACK_IMAGES[key];
    }
    // Partial matches
    for (const [catKey, url] of Object.entries(CATEGORY_FALLBACK_IMAGES)) {
      if (key.includes(catKey) || catKey.includes(key)) {
        return url;
      }
    }
  }
  return kind === 'VENUE' ? DEFAULT_SPACE_IMAGE : DEFAULT_SERVICE_IMAGE;
}

/**
 * Parses user input to extract direct image URLs if they pasted a search redirect link
 * or a Google Drive link, or provides a category-specific fallback.
 */
export function cleanImageUrl(url?: string | null, category?: string): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return category ? getCategoryFallback(category) : '';
  }
  let trimmed = url.trim().replace(/^["']|["']$/g, '');

  // Convert Google Drive view links to direct image thumbnail URLs
  if (trimmed.includes('drive.google.com')) {
    const idMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    }
  }

  // Handle share.google short links or non-direct Google web links by falling back to category photo
  if (trimmed.includes('share.google') || (trimmed.startsWith('https://google.com') && !trimmed.includes('imgurl='))) {
    return getCategoryFallback(category);
  }

  // Extract from Google Images search redirects
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
 * Handles image rendering failure by smoothly substituting the category fallback image,
 * preventing broken icon displays.
 */
export function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  categoryOrFallback: string = DEFAULT_SERVICE_IMAGE
) {
  const target = e.currentTarget;
  const fallback = categoryOrFallback.startsWith('http')
    ? categoryOrFallback
    : getCategoryFallback(categoryOrFallback);

  if (target.src !== fallback) {
    target.onerror = null;
    target.src = fallback;
  }
}
