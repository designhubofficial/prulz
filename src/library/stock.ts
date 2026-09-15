/**
 * Curated stock photography for email bodies.
 *
 * Email clients load images from a hosted URL — a file on the sender's drive
 * cannot reach a patient's inbox — so these photos are remote, hotlinkable
 * URLs from Unsplash's CDN. Every URL below was verified to serve `image/jpeg`.
 *
 * All photos are used under the Unsplash License (free to use, no attribution
 * required). The studio still sends nothing anywhere: choosing a photo only
 * writes its URL into the template, exactly like typing one in by hand.
 *
 * Keep the set small and calm. This tool writes mail for a healthcare
 * practice, where a stock photo should put a reader at ease, not shout.
 */

export interface StockPhoto {
  id: string;
  /** Full https URL, ready to drop into `[Image: …]`. */
  url: string;
  /** Suggested alt text — the thing a patient reads when images are blocked. */
  alt: string;
  /** Short label for the picker grid. */
  label: string;
}

export interface StockCategory {
  key: string;
  label: string;
  hint: string;
  photos: StockPhoto[];
}

const px = (id: string, faces = false): string => {
  // One consistent banner crop (≈12:7) keeps every slot looking deliberate,
  // whether it renders full-width or beside text. People photos request a
  // face-aware crop so heads are never cut off the frame.
  const crop = faces ? '&crop=faces' : '';
  return `https://images.unsplash.com/${id}?q=80&w=1200&h=700&auto=format&fit=crop${crop}`;
};

export const STOCK_CATEGORIES: StockCategory[] = [
  {
    key: 'calm',
    label: 'Calm & nature',
    hint: 'Reassuring scenes for check-ins, re-engagement and seasonal mail.',
    photos: [
      { id: 'forest-light', label: 'Sunlit forest', url: px('photo-1441974231531-c6227db76b6e'), alt: 'Sunlight filtering through the trees of a quiet forest' },
      { id: 'misty-hills', label: 'Misty hills', url: px('photo-1470071459604-3b5ec3a7fe05'), alt: 'Morning mist over soft green hills' },
      { id: 'mountain-valley', label: 'Mountain valley', url: px('photo-1506905925346-21bda4d32df4'), alt: 'A calm mountain valley in the evening light' },
      { id: 'quiet-beach', label: 'Quiet shoreline', url: px('photo-1507525428034-b723cf961d3e'), alt: 'A quiet beach at sunrise' },
    ],
  },
  {
    key: 'people',
    label: 'People & care',
    hint: 'Human faces and gestures — trust before the first appointment.',
    photos: [
      { id: 'meditating', label: 'Quiet moment', url: px('photo-1506126613408-eca07ce68773', true), alt: 'A person taking a quiet moment to meditate outdoors' },
      { id: 'smiling-woman', label: 'Smiling woman', url: px('photo-1494790108377-be9c29b29330', true), alt: 'Portrait of a woman smiling warmly' },
      { id: 'smiling-man', label: 'Smiling man', url: px('photo-1500648767791-00dcc994a43e', true), alt: 'Portrait of a man smiling' },
      { id: 'clinician-desk', label: 'Clinician at work', url: px('photo-1573496359142-b8d87734a5a2', true), alt: 'A professional woman at work in a bright office' },
    ],
  },
  {
    key: 'workspace',
    label: 'Workspace & texture',
    hint: 'Team, desk and background imagery for newsletters and updates.',
    photos: [
      { id: 'team-table', label: 'Team meeting', url: px('photo-1522071820081-009f0129c71c'), alt: 'A small team collaborating around a table' },
      { id: 'team-laptops', label: 'Colleagues working', url: px('photo-1521737711867-e3b97375f902'), alt: 'Colleagues working side by side on laptops' },
      { id: 'desk-notebook', label: 'Desk & notebook', url: px('photo-1499750310107-5fef28a66643'), alt: 'A tidy desk with a notebook, coffee and soft light' },
      { id: 'journal-writing', label: 'Writing by hand', url: px('photo-1517842645767-c639042777db'), alt: 'Hands writing in a journal at a wooden desk' },
      { id: 'soft-gradient', label: 'Soft colour field', url: px('photo-1557683316-973673baf926'), alt: 'A soft blue gradient background' },
    ],
  },
];

export const STOCK_PHOTOS: StockPhoto[] = STOCK_CATEGORIES.flatMap((c) => c.photos);

export function stockById(id: string): StockPhoto | undefined {
  return STOCK_PHOTOS.find((p) => p.id === id);
}

/** The default photo for a template sample, by mood. */
export function stockSample(mood: 'calm' | 'people' | 'workspace' = 'calm'): StockPhoto {
  const category = STOCK_CATEGORIES.find((c) => c.key === mood) ?? STOCK_CATEGORIES[0];
  return category.photos[0];
}
