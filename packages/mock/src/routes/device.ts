import { Hono } from "hono";
import {
  findByUserCode,
  updateStatus,
} from "../store/devices.js";

const device = new Hono();

function renderPage(content: string): Response {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>supsub-cli 授权</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 24px; }
    h1 { font-size: 1.5rem; margin-bottom: 24px; }
    .code { font-size: 2rem; font-weight: bold; letter-spacing: 4px; color: #1a1a1a; margin: 24px 0; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
    a.btn { display: inline-block; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; }
    .btn-approve { background: #16a34a; color: white; }
    .btn-deny { background: #dc2626; color: white; }
    .btn-expire { background: #9ca3af; color: white; }
    input { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; }
    button { padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
    .done { color: #16a34a; font-weight: bold; }
    .error { color: #dc2626; }
  </style>
</head>
<body>
  <h1>supsub-cli 授权</h1>
  ${content}
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** GET /device */
device.get("/", (c) => {
  const userCode = c.req.query("user_code");
  const done = c.req.query("done");

  if (!userCode) {
    // No user_code: show input form
    const content = `
      <p>请输入您设备上显示的授权码：</p>
      <form method="get" action="/device">
        <input name="user_code" placeholder="XXXX-XXXX" autofocus />
        <button type="submit">确认</button>
      </form>`;
    return renderPage(content);
  }

  const record = findByUserCode(userCode);

  if (!record) {
    const content = `<p class="error">未找到授权码 <strong>${userCode}</strong>，请检查后重试。</p>`;
    return renderPage(content);
  }

  if (record.status !== "pending") {
    const statusMap: Record<string, string> = {
      authorized: "✅ 已授权",
      denied: "❌ 已拒绝",
      expired: "⏰ 已过期",
    };
    const label = statusMap[record.status] ?? record.status;
    const doneMsg = done
      ? `<p class="done">操作完成：${label}</p>`
      : `<p>当前状态：${label}</p>`;
    const content = `
      <p>授权码：<span class="code">${userCode}</span></p>
      ${doneMsg}`;
    return renderPage(content);
  }

  const doneMsg = done ? `<p class="done">操作已完成！</p>` : "";
  const content = `
    <p>以下设备正在请求授权：</p>
    <div class="code">${userCode}</div>
    ${doneMsg}
    <div class="actions">
      <a href="/device/_action?op=authorize&user_code=${userCode}" class="btn btn-approve">✅ 自动授权</a>
      <a href="/device/_action?op=deny&user_code=${userCode}" class="btn btn-deny">❌ 拒绝</a>
      <a href="/device/_action?op=expire&user_code=${userCode}" class="btn btn-expire">⏰ 模拟过期</a>
    </div>`;
  return renderPage(content);
});

/** GET /device/_action?op=authorize|deny|expire&user_code=... */
device.get("/_action", (c) => {
  const op = c.req.query("op");
  const userCode = c.req.query("user_code");

  if (!userCode || !op) {
    return renderPage(`<p class="error">缺少参数。</p>`);
  }

  const record = findByUserCode(userCode);
  if (!record) {
    return renderPage(
      `<p class="error">未找到授权码 <strong>${userCode}</strong>。</p>`,
    );
  }

  if (op === "authorize") {
    updateStatus(userCode, "authorized");
  } else if (op === "deny") {
    updateStatus(userCode, "denied");
  } else if (op === "expire") {
    updateStatus(userCode, "expired");
  } else {
    return renderPage(`<p class="error">未知操作 ${op}。</p>`);
  }

  return new Response(null, {
    status: 302,
    headers: { Location: `/device?user_code=${userCode}&done=1` },
  });
});

export default device;
