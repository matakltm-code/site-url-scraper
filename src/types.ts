export interface LogMessage {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'progress';
  timestamp: number;
  current?: number;
  total?: number;
  jobId?: string;
}

export interface TreeNode {
  id: string;
  label: string;
  type: 'domain' | 'folder' | 'page';
  children?: TreeNode[];
}

export type CrawlPhase = 'idle' | 'crawling' | 'review' | 'mirroring' | 'done' | 'error';

