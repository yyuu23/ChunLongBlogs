export type ContentContextKind = "home" | "post" | "series" | "project" | "lab";

export interface ContentContext {
  kind: ContentContextKind;
  slug?: string;
}

export type ContentRecommendationType = "post" | "series" | "project" | "lab";

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
