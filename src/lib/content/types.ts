export type ContentContextKind = "home" | "post" | "series" | "project" | "lab";

export interface ContentContext {
  kind: ContentContextKind;
  slug?: string;
}

export type ContentRecommendationType = "post" | "series" | "project" | "lab";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface ContentRecommendation {
  type: ContentRecommendationType;
  title: string;
  url: string;
  description: string;
  reason: string;
  minutes?: number;
  difficulty?: "beginner" | "intermediate" | "advanced";
  cover?: string;
}

export interface PublicSeriesSummary {
  id: number;
  title: string;
  slug: string;
  description: string;
  cover: string;
  postCount: number;
  totalMinutes: number;
}

export interface SeriesPostItem {
  id: number;
  title: string;
  slug: string;
  description: string;
  cover: string;
  order: number;
  difficulty: Difficulty | null;
  readingTime: number;
  publishedAt: Date | null;
}

export interface PublicSeriesDetail extends PublicSeriesSummary {
  posts: SeriesPostItem[];
}

export interface PublicProject {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  cover: string;
  techStack: string[];
  repoUrl: string;
  demoUrl: string;
  labSlug: string | null;
  stage: "planned" | "in_progress" | "maintaining" | "completed" | "archived";
  sort: number;
  startedAt: Date | null;
  updatedAt: Date;
  posts: Array<{ id: number; title: string; slug: string; description: string; readingTime: number }>;
}

export interface GuidePreferences {
  interests: string[];
  level?: "beginner" | "intermediate" | "advanced";
  goal?: string;
  updatedAt: number;
  expiresAt: number;
}

export interface SeriesProposalItem {
  postId: number;
  order: number;
  reason: string;
}

export interface SeriesProposalGroup {
  existingSeriesId?: number;
  newSeries?: {
    title: string;
    slug: string;
    description: string;
  };
  items: SeriesProposalItem[];
}

export interface SeriesProposal {
  groups: SeriesProposalGroup[];
  unassignedPostIds: number[];
  notes: string[];
}
