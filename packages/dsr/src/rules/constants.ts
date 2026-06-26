/** Slop constant lists (adapted from open-design's lint-artifact.ts, Apache-2.0). */
export const PURPLE_HEXES = [
  '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#c084fc', '#d8b4fe',
  '#8b5cf6', '#7c3aed', '#6d28d9', '#a78bfa', '#c4b5fd',
];
export const AI_DEFAULT_INDIGO = ['#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#8b5cf6', '#7c3aed', '#a855f7'];
export const TRUST_GRADIENT_BLUE = ['#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa'];
export const TRUST_GRADIENT_CYAN = ['#06b6d4', '#22d3ee', '#0891b2', '#67e8f9'];
export const SLOP_EMOJI = ['✨', '🚀', '🎯', '⚡', '🔥', '💡', '📈', '🎨', '🛡️', '🌟', '💪', '🙌', '👏', '✅'];
export const INVENTED_METRIC_PATTERNS: RegExp[] = [
  /\b\d+(?:\.\d+)?\s*[x×]\s*(?:faster|more|better|productive)\b/i,
  /\b99\.9+\s*%\s*uptime\b/i,
  /\bzero[-\s]?downtime\b/i,
  /\b\d+(?:,\d{3})*\+?\s*(?:happy\s+)?(?:customers|users|teams)\b/i,
];
export const FILLER_PATTERNS: RegExp[] = [
  /\bfeature\s+(?:one|two|three|1|2|3)\b/i,
  /\blorem\s+ipsum\b/i,
  /\bdolor\s+sit\s+amet\b/i,
  /\bplaceholder\s+text\b/i,
  /\bsample\s+content\b/i,
];
export const EXTERNAL_IMAGE_HOSTS = [
  'unsplash.com', 'placehold.co', 'placekitten.com', 'via.placeholder.com', 'picsum.photos', 'loremflickr.com',
];
export const SANS_FAMILIES = /\b(Inter|Roboto|Arial|-apple-system|system-ui|SF Pro)\b/i;
