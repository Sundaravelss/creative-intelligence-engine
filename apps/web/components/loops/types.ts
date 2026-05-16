export interface Loop {
  id: string;
  name: string;
  cron: string;
  channel: string;
  prompt: string;
  format: string;
  created_at: string;
}

export interface LoopRun {
  post_id: string;
  channel: string;
  posted_at: string;
  loop_id?: string;
  copy?: string;
  artifact_id?: string;
  insights?: Record<string, unknown>;
}

export interface CreateLoopInput {
  name: string;
  cron: string;
  channel: string;
  prompt: string;
  format: string;
}
