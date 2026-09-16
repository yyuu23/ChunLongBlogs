export interface PostInput {
  id?: number;
  title: string;
  slug?: string;
  description?: string;
  content: string;
  cover?: string;
  categoryId?: number | null;
  tagNames: string[];
  status: "draft" | "published" | "scheduled";
  isPinned?: boolean;
  /** published 时忽略；scheduled 时为目标时刻；draft 时忽略。 */
  publishedAt?: string | null;
}
