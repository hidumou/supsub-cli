// packages/cli/src/api/mp.ts
import { request } from '../http/client.ts';
import type { MpSearchTaskResult } from '../lib/types.ts';

/** POST /api/mps/search-tasks — 创建公众号搜索任务 */
export async function createSearchTask(body: { name: string }): Promise<{ searchId: string }> {
  return request<{ searchId: string }>({
    method: 'POST',
    path: '/api/mps/search-tasks',
    body,
  });
}

/** GET /api/mps/search-tasks/{searchId} — 查询搜索任务状态 */
export async function getSearchTask(searchId: string): Promise<MpSearchTaskResult> {
  return request<MpSearchTaskResult>({
    method: 'GET',
    path: `/api/mps/search-tasks/${searchId}`,
  });
}

/** DELETE /api/mps/search-tasks/{searchId} — 取消搜索任务 */
export async function cancelSearchTask(searchId: string): Promise<void> {
  await request<undefined>({
    method: 'DELETE',
    path: `/api/mps/search-tasks/${searchId}`,
  });
}

/** POST /api/mps — 用 mpId 添加公众号订阅（mpId 是 mp search 返回的 base64 字符串，不是内部 sourceId） */
export async function addMp(body: {
  mpId: string;
  groupIds?: number[];
}): Promise<{ message: string }> {
  return request<{ message: string }>({
    method: 'POST',
    path: '/api/mps',
    body,
  });
}
