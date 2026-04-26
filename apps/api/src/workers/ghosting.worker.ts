export type GhostingJobPayload = {
  id: string;
  metadata?: Record<string, string>;
};

export const ghostingQueueName = 'ghosting';
