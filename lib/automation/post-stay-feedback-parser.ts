export type DirectPostStayFeedback = {
  rating: number;
  comments: string;
};

const EXPLICIT_RATING_PATTERNS = [
  /\b(?:rate|rating|score|nilai)\s*(?:dari\s*saya|saya|ku|kami|nya|:|=|-)?\s*([1-5])\b/i,
  /\b(?:saya|aku|kami)\s*(?:kasih|beri|berikan|memberi)\s*(?:rating|rate|nilai|score)?\s*([1-5])\b/i,
  /\b([1-5])\s*(?:bintang|star|stars)\b/i,
];

export function parseDirectPostStayFeedback(
  text: string,
): DirectPostStayFeedback | null {
  const comments = text.trim().replace(/\s+/g, " ");

  if (!comments) {
    return null;
  }

  for (const pattern of EXPLICIT_RATING_PATTERNS) {
    const match = comments.match(pattern);
    const rating = Number(match?.[1]);

    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
      return {
        rating,
        comments,
      };
    }
  }

  return null;
}
