const express = require('express');
const prisma = require('../config/prisma');
const { AI_ALLOWED_STATUS, AI_ALLOWED_CONTRACT } = require('../lib/validators');
const { getUserAiConfig, chatCompletion, messageContent } = require('../lib/aiClient');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const notConfigured = { error: 'AI is not configured. Add an API base URL and key in AI Settings first.' };
const providerError = (res, err) =>
  res.status(502).json({ error: `AI provider error (${err.providerStatus}). ${err.providerDetail}` });

// ----- Config -----

router.get('/ai/config', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { aiApiBase: true, aiModel: true, aiApiKey: true, aiMaxRetries: true },
    });
    res.json({
      apiBase: user.aiApiBase || '',
      model: user.aiModel || '',
      hasKey: !!user.aiApiKey,
      maxRetries: user.aiMaxRetries ?? 2,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get AI config' });
  }
});

// An empty apiKey string leaves the existing key untouched.
router.put('/ai/config', authenticateToken, async (req, res) => {
  const { apiBase, apiKey, model, maxRetries } = req.body;
  try {
    const data = {
      aiApiBase: typeof apiBase === 'string' ? apiBase.trim() : undefined,
      aiModel: typeof model === 'string' ? model.trim() : undefined,
    };
    if (typeof apiKey === 'string' && apiKey.trim().length > 0) data.aiApiKey = apiKey.trim();
    if (maxRetries !== undefined && maxRetries !== null && maxRetries !== '') {
      const n = Math.round(Number(maxRetries));
      if (Number.isFinite(n)) data.aiMaxRetries = Math.max(0, Math.min(5, n));
    }
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({ apiBase: user.aiApiBase || '', model: user.aiModel || '', hasKey: !!user.aiApiKey, maxRetries: user.aiMaxRetries ?? 2 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save AI config' });
  }
});

router.delete('/ai/config', authenticateToken, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { aiApiBase: null, aiApiKey: null, aiModel: null, aiMaxRetries: 2 },
    });
    res.json({ apiBase: '', model: '', hasKey: false, maxRetries: 2 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete AI config' });
  }
});

// ----- Parse a free-text job description into structured fields -----

router.post('/ai/parse-job', authenticateToken, async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length < 3) {
    return res.status(400).json({ error: 'Please provide the job description or details to parse.' });
  }
  const input = text.trim().slice(0, 6000);

  try {
    const cfg = await getUserAiConfig(req.user.id, { withRetries: true });
    if (!cfg) return res.status(400).json(notConfigured);

    const REQUIRED_KEYS = ['company', 'position', 'link', 'platform', 'salary', 'contractType', 'notes'];
    const systemPrompt = 'You extract structured job-application data from text the user provides. ' +
      'Respond with ONLY a single compact JSON object, no markdown, no code fences, no explanation. ' +
      `The object MUST contain exactly these keys: ${REQUIRED_KEYS.join(', ')}. ` +
      'contractType must be one of: Full-time, Part-time, Contract, CDI, CDD, Intern, Freelance, or empty string. ' +
      '(CDI = French permanent contract, CDD = French fixed-term contract.) ' +
      'link is the job posting URL if present, else empty. platform is the site/source (e.g. LinkedIn) if inferable, else empty. ' +
      'salary is a short string if mentioned, else empty. notes: a one-line summary of key requirements if useful, else empty. ' +
      'Every value must be a string. Use only information present in the text; do not invent facts. Unknown fields must be empty strings.';

    const validateOutput = (content) => {
      const errors = [];
      let parsed;
      try {
        const cleaned = String(content).replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        return { errors: ['The response was not valid JSON — it could not be parsed. Return ONLY a single JSON object.'], result: null };
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { errors: ['The response must be a single JSON object (not an array or primitive).'], result: null };
      }
      const missing = REQUIRED_KEYS.filter((k) => !(k in parsed));
      if (missing.length) errors.push(`Missing required keys: ${missing.join(', ')}.`);
      const nonString = REQUIRED_KEYS.filter((k) => k in parsed && typeof parsed[k] !== 'string');
      if (nonString.length) errors.push(`These keys must be string values: ${nonString.join(', ')}.`);
      const rawContract = typeof parsed.contractType === 'string' ? parsed.contractType.trim() : '';
      if (rawContract && !AI_ALLOWED_CONTRACT.includes(rawContract)) {
        errors.push(`contractType "${rawContract}" is invalid. Use one of: Full-time, Part-time, Contract, CDI, CDD, Intern, Freelance, or "".`);
      }
      const str = (v) => (typeof v === 'string' ? v.trim() : '');
      let contractType = str(parsed.contractType);
      if (!AI_ALLOWED_CONTRACT.includes(contractType)) contractType = '';
      let status = str(parsed.status);
      if (!AI_ALLOWED_STATUS.includes(status)) status = 'To Apply';
      const result = {
        company: str(parsed.company).slice(0, 200),
        position: str(parsed.position).slice(0, 200),
        link: str(parsed.link).slice(0, 500),
        platform: str(parsed.platform).slice(0, 100),
        salary: str(parsed.salary).slice(0, 100),
        contractType,
        notes: str(parsed.notes).slice(0, 2000),
        status,
      };
      return { errors, result };
    };

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ];

    let lastFormatError = '';
    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      let payload;
      try {
        payload = await chatCompletion(cfg, {
          temperature: 0, max_tokens: 1000, messages, response_format: { type: 'json_object' },
          // Reasoning models (e.g. MiniMax M2 on NVIDIA) routinely take 1-2 min; nginx allows 180s.
        }, { timeoutMs: 150000 });
      } catch (err) {
        if (err.providerStatus) return providerError(res, err);
        throw err;
      }
      const content = messageContent(payload);
      const { errors, result } = validateOutput(content);
      if (errors.length === 0) return res.json(result);

      lastFormatError = errors.join(' ');
      if (attempt < cfg.maxRetries) {
        messages.push({ role: 'assistant', content });
        messages.push({
          role: 'user',
          content: `Your previous response did not meet the required format. Problems: ${lastFormatError} ` +
            `Respond again with ONLY a single valid JSON object containing exactly these keys: ${REQUIRED_KEYS.join(', ')}. No markdown, no code fences.`,
        });
      }
    }
    return res.status(502).json({
      error: `AI did not return a valid format after ${cfg.maxRetries + 1} attempt(s). ${lastFormatError} Try again or refine the text.`,
    });
  } catch (error) {
    if (error.name === 'AbortError') return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    console.error('AI parse-job failed:', error.message);
    res.status(500).json({ error: 'Failed to parse job with AI.' });
  }
});

// ----- Generate one reusable motivation-letter paragraph ("cell") -----

router.post('/ai/generate-cell', authenticateToken, async (req, res) => {
  const { description, minWords, maxWords } = req.body;
  if (!description || typeof description !== 'string' || description.trim().length < 3) {
    return res.status(400).json({ error: 'Please describe what the paragraph should say.' });
  }
  const input = description.trim().slice(0, 4000);
  const toBound = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 2000) : null;
  };
  const lo = toBound(minWords);
  const hi = toBound(maxWords);

  try {
    const cfg = await getUserAiConfig(req.user.id, { withRetries: true });
    if (!cfg) return res.status(400).json(notConfigured);

    // Length is measured in "units": one CJK character (Chinese/Japanese/Korean)
    // OR one space-delimited word for languages that use spaces. This makes the
    // limit meaningful for Chinese cover letters (字数), not just English.
    const UNIT_DESC = 'length is counted as the number of Chinese/Japanese/Korean characters plus the number of words in space-separated languages (i.e. 字数 for Chinese, word count for English)';
    let lengthRule = 'Choose a natural length for the paragraph yourself.';
    if (lo && hi) {
      const mid = Math.round((lo + hi) / 2);
      lengthRule = `The content length MUST be between ${lo} and ${hi}, where ${UNIT_DESC}. Aim for about ${mid}. Do not exceed ${hi}.`;
    } else if (lo) {
      lengthRule = `The content length MUST be at least ${lo}, where ${UNIT_DESC}.`;
    } else if (hi) {
      lengthRule = `The content length MUST be at most ${hi}, where ${UNIT_DESC}. Do not exceed ${hi}.`;
    }

    const systemPrompt = 'You write one reusable building block ("cell") of a motivation / cover letter based on the user\'s description. ' +
      'Respond with ONLY a single compact JSON object, no markdown, no code fences, no explanation. ' +
      'The object MUST contain exactly these keys: "title" (a short 2-4 word label naming the block, e.g. "Why this company") ' +
      'and "content" (the paragraph text only — no salutation or signature unless explicitly requested). ' +
      'Write the content in the same language as the user\'s description. ' +
      'Use only information the user provided; do not invent specific facts, names, or numbers. ' + lengthRule;

    // CJK-aware length: each CJK/kana char counts as one unit; runs of non-CJK
    // text are counted as space-separated words.
    const CJK = /[㐀-鿿豈-﫿぀-ヿ가-힯]/g;
    const countLen = (s) => {
      const t = (s || '').trim();
      if (!t) return 0;
      const cjk = (t.match(CJK) || []).length;
      const rest = t.replace(CJK, ' ').trim();
      const words = rest ? rest.split(/\s+/).filter(Boolean).length : 0;
      return cjk + words;
    };
    const validateOutput = (content) => {
      const errors = [];
      let parsed;
      try {
        const cleaned = String(content).replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        return { errors: ['The response was not valid JSON. Return ONLY a single JSON object.'], result: null };
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { errors: ['The response must be a single JSON object.'], result: null };
      }
      if (typeof parsed.title !== 'string' || !parsed.title.trim()) errors.push('"title" must be a non-empty string.');
      if (typeof parsed.content !== 'string' || !parsed.content.trim()) errors.push('"content" must be a non-empty string.');
      if (errors.length) return { errors, result: null };

      // Tight-but-forgiving bounds (~15%) — LLMs can't hit an exact count, but
      // this keeps results close and feeds the real measured length back on retry.
      const len = countLen(parsed.content);
      if (hi && len > Math.ceil(hi * 1.15)) errors.push(`content length is ${len} but the maximum is ${hi} (${UNIT_DESC}). It is too long — shorten it to at most ${hi}.`);
      if (lo && len < Math.floor(lo * 0.85)) errors.push(`content length is ${len} but the minimum is ${lo} (${UNIT_DESC}). It is too short — expand it to at least ${lo}.`);

      return {
        errors,
        result: { title: parsed.title.trim().slice(0, 100), content: parsed.content.trim().slice(0, 8000) },
      };
    };

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ];

    let lastFormatError = '';
    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      let payload;
      try {
        payload = await chatCompletion(cfg, {
          temperature: 0.7,
          max_tokens: hi ? Math.min(4000, hi * 3 + 300) : 1200,
          messages,
          response_format: { type: 'json_object' },
        }, { timeoutMs: 150000 });
      } catch (err) {
        if (err.providerStatus) return providerError(res, err);
        throw err;
      }
      const content = messageContent(payload);
      const { errors, result } = validateOutput(content);
      if (errors.length === 0) return res.json(result);

      lastFormatError = errors.join(' ');
      if (attempt < cfg.maxRetries) {
        messages.push({ role: 'assistant', content });
        messages.push({
          role: 'user',
          content: `Your previous response did not meet the requirements. Problems: ${lastFormatError} ` +
            'Respond again with ONLY a single valid JSON object with keys "title" and "content". No markdown, no code fences.',
        });
      }
    }
    return res.status(502).json({
      error: `AI did not return a valid result after ${cfg.maxRetries + 1} attempt(s). ${lastFormatError}`,
    });
  } catch (error) {
    if (error.name === 'AbortError') return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    console.error('AI generate-cell failed:', error.message);
    res.status(500).json({ error: 'Failed to generate the cell with AI.' });
  }
});

// ----- Summarize the current board -----

router.post('/ai/summary', authenticateToken, async (req, res) => {
  const { applications } = req.body;
  if (!Array.isArray(applications) || applications.length === 0) {
    return res.status(400).json({ error: 'No applications to analyze. Adjust your filters and try again.' });
  }

  try {
    const cfg = await getUserAiConfig(req.user.id);
    if (!cfg) return res.status(400).json({ error: 'AI is not configured. Add an API base URL and key in Settings first.' });

    const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
    const rows = applications.slice(0, 120).map((a, i) => ({
      i: i + 1,
      company: str(a.company).slice(0, 80),
      position: str(a.position).slice(0, 100),
      status: str(a.status).slice(0, 30),
      salary: str(a.salary).slice(0, 40),
      contractType: str(a.contractType).slice(0, 30),
      platform: str(a.platform).slice(0, 40),
      starred: !!a.isStarred,
      notes: str(a.notes).slice(0, 200),
    }));
    const counts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

    const systemPrompt =
      'You are a candid, practical job-search coach. You are given a snapshot of the applications a ' +
      'candidate currently has on their tracking board (as JSON). Write a SHORT report in clean Markdown with these sections:\n' +
      '## Overview — 2-3 sentences on the overall state of the pipeline (volume, balance across stages, momentum).\n' +
      '## Most worth pursuing — a ranked list (max 5) of the specific companies/roles that look most promising, ' +
      'each with a one-line reason grounded in the data (salary, stage progress, starred, fit signals in notes).\n' +
      '## Watch-outs — brief bullets on gaps or risks (e.g. too many stalled at one stage, missing salary info, rejections to learn from).\n' +
      '## Next actions — 2-4 concrete, prioritized next steps.\n' +
      'Be concise and specific. Only use the data provided; never invent facts. Refer to roles by "Company — Position". ' +
      'Respond in English. Do not wrap the whole answer in a code fence.';

    const userContent =
      `Stage counts: ${JSON.stringify(counts)}\n` +
      `Total in view: ${rows.length}\n` +
      `Applications JSON:\n${JSON.stringify(rows)}`;

    let payload;
    try {
      payload = await chatCompletion(cfg, {
        temperature: 0.3, max_tokens: 900,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }, { timeoutMs: 150000 });
    } catch (err) {
      if (err.providerStatus) return providerError(res, err);
      throw err;
    }

    const content = messageContent(payload);
    if (!content.trim()) return res.status(502).json({ error: 'AI returned an empty response. Please try again.' });
    res.json({ summary: content.trim(), counts, total: rows.length });
  } catch (error) {
    if (error.name === 'AbortError') return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    console.error('AI summary failed:', error.message);
    res.status(500).json({ error: 'Failed to generate summary with AI.' });
  }
});

module.exports = router;
