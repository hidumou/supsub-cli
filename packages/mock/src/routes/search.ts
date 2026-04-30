import { Hono } from "hono";
import { sources } from "../fixtures/sources.js";
import { articles } from "../fixtures/articles.js";

const search = new Hono();

/** GET /api/search?type=ALL|MP|WEBSITE|CONTENT&keywords=&page=&pageSize= */
search.get("/", (c) => {
  const type = c.req.query("type") ?? "ALL";
  const keywords = (c.req.query("keywords") ?? "").toLowerCase();
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const pageSize = parseInt(c.req.query("pageSize") ?? "10", 10);

  const results: { type: string; data: Record<string, unknown> }[] = [];

  if (keywords === "") {
    return c.json({ results: [], recommendations: [], prompts: [] });
  }

  // Search sources
  if (type === "ALL" || type === "MP" || type === "WEBSITE") {
    for (const s of sources) {
      if (type !== "ALL" && s.sourceType !== type) continue;

      const matches =
        s.name.toLowerCase().includes(keywords) ||
        s.description.toLowerCase().includes(keywords);

      if (matches) {
        results.push({
          type: "SOURCE",
          data: {
            sourceId: s.sourceId,
            sourceType: s.sourceType,
            name: s.name,
            img: s.img,
            description: s.description,
            isSubscribed: true,
            introduction: "",
          },
        });
      }
    }
  }

  // Search articles/content
  if (type === "ALL" || type === "CONTENT") {
    for (const a of articles) {
      const matches =
        a.title.toLowerCase().includes(keywords) ||
        a.summary.toLowerCase().includes(keywords) ||
        a.tags.some((t) => t.toLowerCase().includes(keywords));

      if (matches) {
        results.push({
          type: "CONTENT",
          data: {
            contentId: a.articleId,
            title: a.title,
            url: a.url,
            coverImage: a.coverImage,
            publishedAt: a.publishedAt,
            summary: a.summary,
            keywords: a.tags,
            sourceId: a.sourceId,
            sourceType: a.sourceType,
            isSubscribed: true,
          },
        });
      }
    }
  }

  // Paginate
  const start = (page - 1) * pageSize;
  const paged = results.slice(start, start + pageSize);

  return c.json({
    results: paged,
    recommendations: [],
    prompts: [],
  });
});

export default search;
