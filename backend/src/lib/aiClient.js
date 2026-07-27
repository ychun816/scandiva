const prisma = require('../config/prisma');

// Load a user's saved OpenAI-compatible config, or null if not configured.
async function getUserAiConfig(userId, { withRetries = false } = {}) {
  const select = { aiApiBase: true, aiApiKey: true, aiModel: true };
  if (withRetries) select.aiMaxRetries = true;
  const user = await prisma.user.findUnique({ where: { id: userId }, select });
  if (!user || !user.aiApiKey || !user.aiApiBase) return null;

  const base = user.aiApiBase.replace(/\/+$/, '');
  return {
    url: base.endsWith('/chat/completions') ? base : `${base}/chat/completions`,
    apiKey: user.aiApiKey,
    model: user.aiModel || 'gpt-4o-mini',
    maxRetries: withRetries
      ? Math.max(0, Math.min(5, Math.round(Number(user.aiMaxRetries ?? 2)) || 0))
      : 0,
  };
}

// POST a chat-completion request with a hard timeout. Returns the parsed body.
// Throws { status, detail } on a non-OK provider response so callers can 502.
async function chatCompletion(cfg, body, { timeoutMs = 45000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let apiRes;
  try {
    apiRes = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, ...body }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!apiRes.ok) {
    const detail = await apiRes.text().catch(() => '');
    const err = new Error('AI provider error');
    err.providerStatus = apiRes.status;
    err.providerDetail = detail.slice(0, 200);
    throw err;
  }
  return apiRes.json();
}

const messageContent = (payload) => payload?.choices?.[0]?.message?.content || '';

module.exports = { getUserAiConfig, chatCompletion, messageContent };
