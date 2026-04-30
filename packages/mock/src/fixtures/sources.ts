export interface SubSource {
  sourceId: number;
  sourceType: "MP" | "WEBSITE";
  name: string;
  img: string;
  description: string;
  /** Initial unread count (used as baseline before reads store overrides) */
  initialUnread: number;
}

export const sources: SubSource[] = [
  // 5 MP sources
  {
    sourceId: 42,
    sourceType: "MP",
    name: "歸藏的AI工具箱",
    img: "https://picsum.photos/seed/mp42/64/64",
    description: "产品设计师 / AI 画图工具操作员",
    initialUnread: 4,
  },
  {
    sourceId: 108,
    sourceType: "MP",
    name: "果粉俱乐部",
    img: "https://picsum.photos/seed/mp108/64/64",
    description: "始于苹果，不止于苹果",
    initialUnread: 0,
  },
  {
    sourceId: 81,
    sourceType: "MP",
    name: "PaperAgent",
    img: "https://picsum.photos/seed/mp81/64/64",
    description: "日更，解读 AI 前沿 paper",
    initialUnread: 7,
  },
  {
    sourceId: 87,
    sourceType: "MP",
    name: "高可用架构",
    img: "https://picsum.photos/seed/mp87/64/64",
    description: "高可用架构公众号",
    initialUnread: 2,
  },
  {
    sourceId: 999,
    sourceType: "MP",
    name: "晚点 LatePost",
    img: "https://picsum.photos/seed/mp999/64/64",
    description: "商业故事与商业逻辑",
    initialUnread: 11,
  },
  // 3 WEBSITE sources
  {
    sourceId: 1001,
    sourceType: "WEBSITE",
    name: "Hacker News",
    img: "https://picsum.photos/seed/web1001/64/64",
    description: "Tech news aggregator",
    initialUnread: 23,
  },
  {
    sourceId: 1002,
    sourceType: "WEBSITE",
    name: "Anthropic Blog",
    img: "https://picsum.photos/seed/web1002/64/64",
    description: "Official Anthropic company blog",
    initialUnread: 1,
  },
  {
    sourceId: 1003,
    sourceType: "WEBSITE",
    name: "Bun Blog",
    img: "https://picsum.photos/seed/web1003/64/64",
    description: "Official Bun JavaScript runtime blog",
    initialUnread: 0,
  },
];

export function findSource(
  sourceType: string,
  sourceId: number,
): SubSource | undefined {
  return sources.find(
    (s) => s.sourceType === sourceType && s.sourceId === sourceId,
  );
}
