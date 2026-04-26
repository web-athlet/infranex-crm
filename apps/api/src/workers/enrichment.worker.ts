export type EnrichmentJobPayload = {
  id: string;
  metadata?: Record<string, string>;
};

export const enrichmentQueueName = 'enrichment';
