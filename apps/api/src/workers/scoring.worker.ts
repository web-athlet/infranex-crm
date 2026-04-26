export type ScoringJobPayload = {
  id: string;
  metadata?: Record<string, string>;
};

export const scoringQueueName = 'scoring';
