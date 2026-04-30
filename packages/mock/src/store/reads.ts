import { articles } from "../fixtures/articles.js";

/** Key format: sourceType:sourceId:articleId */
const readSet = new Set<string>();

// Initialize from fixture default isRead values
for (const article of articles) {
  if (article.isRead) {
    readSet.add(
      `${article.sourceType}:${article.sourceId}:${article.articleId}`,
    );
  }
}

function makeKey(
  sourceType: string,
  sourceId: number,
  articleId: string,
): string {
  return `${sourceType}:${sourceId}:${articleId}`;
}

export function isRead(
  sourceType: string,
  sourceId: number,
  articleId: string,
): boolean {
  return readSet.has(makeKey(sourceType, sourceId, articleId));
}

export function markRead(
  sourceType: string,
  sourceId: number,
  articleId: string,
): void {
  readSet.add(makeKey(sourceType, sourceId, articleId));
}

export function markAllRead(sourceType: string, sourceId: number): void {
  const sourceArticles = articles.filter(
    (a) => a.sourceType === sourceType && a.sourceId === sourceId,
  );
  for (const article of sourceArticles) {
    readSet.add(makeKey(sourceType, sourceId, article.articleId));
  }
}

/** Get unread count for a source by counting articles not in readSet */
export function getUnreadCount(sourceType: string, sourceId: number): number {
  const sourceArticles = articles.filter(
    (a) => a.sourceType === sourceType && a.sourceId === sourceId,
  );
  return sourceArticles.filter(
    (a) => !readSet.has(makeKey(sourceType, sourceId, a.articleId)),
  ).length;
}
