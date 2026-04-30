import { Hono } from "hono";
import { sources, findSource } from "../fixtures/sources.js";
import { getArticles } from "../fixtures/articles.js";
import {
  getUnreadCount,
  isRead,
  markRead,
  markAllRead,
} from "../store/reads.js";
import { httpError } from "../lib/error.js";

const subscriptions = new Hono();

// In-memory subscription list (all sources subscribed by default)
const subscribedSet = new Set<string>(
  sources.map((s) => `${s.sourceType}:${s.sourceId}`),
);

function subKey(sourceType: string, sourceId: number): string {
  return `${sourceType}:${sourceId}`;
}

/** Parse body sourceId — accepts integer or numeric string, throws 400 on invalid */
function parseSourceId(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw httpError(400, "INVALID_REQUEST", "sourceId 必须是正整数");
  }
  return n;
}

/** GET /api/subscriptions?sourceType= */
subscriptions.get("/", (c) => {
  const sourceType = c.req.query("sourceType");

  let filtered = sources.filter((s) =>
    subscribedSet.has(subKey(s.sourceType, s.sourceId)),
  );

  if (sourceType && sourceType !== "") {
    filtered = filtered.filter((s) => s.sourceType === sourceType);
  }

  const result = filtered.map((s) => ({
    sourceType: s.sourceType,
    sourceId: s.sourceId,
    name: s.name,
    img: s.img,
    description: s.description,
    unreadCount: getUnreadCount(s.sourceType, s.sourceId),
  }));

  return c.json(result);
});

/** POST /api/subscriptions */
subscriptions.post("/", async (c) => {
  const body = await c.req.json<{
    sourceType: string;
    sourceId: unknown;
    groupIds?: string[];
  }>();

  if (!body.sourceType) {
    throw httpError(400, "INVALID_REQUEST", "Missing sourceType");
  }
  const sourceType = body.sourceType;
  const sourceId = parseSourceId(body.sourceId);

  const key = subKey(sourceType, sourceId);
  if (subscribedSet.has(key)) {
    throw httpError(400, "ALREADY_SUBSCRIBED", "Already subscribed to this source");
  }

  // Check source exists in fixture (or allow unknown sources)
  subscribedSet.add(key);
  return c.json({ message: "订阅成功" }, 201);
});

/** DELETE /api/subscriptions */
subscriptions.delete("/", async (c) => {
  const body = await c.req.json<{
    sourceType: string;
    sourceId: unknown;
  }>();

  if (!body.sourceType) {
    throw httpError(400, "INVALID_REQUEST", "Missing sourceType");
  }
  const sourceType = body.sourceType;
  const sourceId = parseSourceId(body.sourceId);

  subscribedSet.delete(subKey(sourceType, sourceId));
  return c.json({ message: "取消订阅成功" }, 201);
});

/** GET /api/subscriptions/contents?sourceType=&sourceId=&type=unread|all&page=&pageSize= */
subscriptions.get("/contents", (c) => {
  const sourceType = c.req.query("sourceType") ?? "";
  const sourceIdRaw = c.req.query("sourceId");
  const type = c.req.query("type") ?? "unread";
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const pageSize = parseInt(c.req.query("pageSize") ?? "20", 10);

  if (!sourceType) {
    throw httpError(400, "INVALID_REQUEST", "Missing sourceType");
  }
  const sourceId = parseSourceId(sourceIdRaw);

  if (!findSource(sourceType, sourceId)) {
    throw httpError(404, "NotFound", "Source not found");
  }

  let articleList = getArticles(sourceType, sourceId);

  // Apply isRead from reads store
  articleList = articleList.map((a) => ({
    ...a,
    isRead: isRead(sourceType, sourceId, a.articleId),
  }));

  if (type === "unread") {
    articleList = articleList.filter((a) => !a.isRead);
  }

  // Paginate
  const start = (page - 1) * pageSize;
  const paged = articleList.slice(start, start + pageSize);

  return c.json(
    paged.map((a) => ({
      articleId: a.articleId,
      url: a.url,
      title: a.title,
      coverImage: a.coverImage,
      tags: a.tags,
      summary: a.summary,
      publishedAt: a.publishedAt,
      isRead: a.isRead,
    })),
  );
});

/** POST /api/subscriptions/contents/mark-as-read */
subscriptions.post("/contents/mark-as-read", async (c) => {
  const body = await c.req.json<{
    sourceType: string;
    sourceId: unknown;
    contentId?: string;
  }>();

  if (!body.sourceType) {
    throw httpError(400, "INVALID_REQUEST", "Missing sourceType");
  }
  const sourceType = body.sourceType;
  const sourceId = parseSourceId(body.sourceId);
  const { contentId } = body;

  if (contentId) {
    markRead(sourceType, sourceId, contentId);
  } else {
    markAllRead(sourceType, sourceId);
  }

  return new Response(null, { status: 204 });
});

export default subscriptions;
