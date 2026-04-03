/** Types shared across the MCP server — mirrors SciWeave API contracts */

export interface Citation {
  id: string;
  work_id?: string;
  title: string;
  authors: string[];
  year: number;
  doi?: string;
  url?: string;
  journal?: string;
  abstract?: string;
  biblio?: {
    volume?: string;
    issue?: string;
    first_page?: string;
    last_page?: string;
  };
  fromList?: boolean;
}

export interface FollowUpQuestion {
  label: string;
  question: string;
}

/** Aggregated result from consuming the SSE answer stream */
export interface AnswerResult {
  answer: string;
  citations: Citation[];
  followUpQuestions: FollowUpQuestion[];
  threadId?: string;
  searchId?: string;
  totalResults?: number;
  error?: string;
}

export interface ResearchList {
  id: string;
  name: string;
  description?: string;
  is_public: boolean;
  paper_count: number;
  created_at: string;
  updated_at: string;
}

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  doi?: string;
  url?: string;
  journal?: string;
  abstract?: string;
  status?: string;
  added_at?: string;
}

/** Result from the fast citations-only endpoint (no LLM answer generation) */
export interface FindReferencesResult {
  citations: MinimalCitation[];
  summary_hint: string;
  query_en: string;
  metrics: Record<string, number>;
  search_id: string;
  error?: string;
}

export interface MinimalCitation {
  title: string;
  authors_short: string;
  year?: number;
  doi?: string;
  url?: string;
  snippet: string;
}

export interface ThreadMessage {
  id: string;
  query: string;
  response_data: Array<{
    id: string;
    answer: string;
    citations: Citation[];
    complexity?: string;
  }>;
  created_at: string;
}

export interface ThreadResult {
  id: string;
  query: string;
  response_data: Array<{
    id: string;
    answer: string;
    citations: Citation[];
    complexity?: string;
  }>;
  created_at: string;
  thread_messages?: ThreadMessage[];
}
