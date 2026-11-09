/**
 * Message burst / debounce aggregator.
 */

export interface InboundFragment {
  messageId: string;
  text: string;
  timestamp: number;
}

export function mergeBurst(fragments: InboundFragment[]): {
  mergedText: string;
  count: number;
  messageIds: string[];
  firstTimestamp: number;
  lastTimestamp: number;
} {
  if (!fragments || fragments.length === 0) {
    return {
      mergedText: '',
      count: 0,
      messageIds: [],
      firstTimestamp: Date.now(),
      lastTimestamp: Date.now(),
    };
  }

  // Sort chronologically
  const sorted = [...fragments].sort((a, b) => a.timestamp - b.timestamp);

  const cleanTexts: string[] = [];
  const messageIds: string[] = [];

  for (const f of sorted) {
    const t = (f.text || '').trim();
    if (t) cleanTexts.push(t);
    if (f.messageId) messageIds.push(f.messageId);
  }

  return {
    mergedText: cleanTexts.join('\n'),
    count: sorted.length,
    messageIds,
    firstTimestamp: sorted[0].timestamp,
    lastTimestamp: sorted[sorted.length - 1].timestamp,
  };
}

