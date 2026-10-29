import request from "supertest";

// بيسجّل دخول ويرجّع عميل بيحتفظ بالكوكي أوتوماتيك
export async function loginAs(app, username = "admin", password = "1234") {
  const agent = request.agent(app);
  const r = await agent.post("/api/auth/login").send({ username, password });
  if (r.status !== 200) throw new Error(`login failed ${r.status} ${JSON.stringify(r.body)}`);
  const withBody = (m) => (url, body) => { const q = agent[m](url); return body === undefined ? q : q.send(body); };
  return { agent, cookies: r.headers["set-cookie"], get: (url) => agent.get(url), post: withBody("post"), put: withBody("put"), del: withBody("delete") };
}
