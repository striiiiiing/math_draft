import { DEFAULT_SYSTEM_PROMPT } from './constants';

export function buildChatCompletionUrl(rawBaseUrl) {
  const baseUrl = String(rawBaseUrl || '').trim().replace(/\/+$/, '');
  if (!baseUrl) return '';
  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl;
  if (/\/v\d+$/i.test(baseUrl)) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}

export function parseCustomParams(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: true, params: {} };

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: '自定义参数必须是 JSON 对象。' };
    }
    return { ok: true, params: parsed };
  } catch {
    return { ok: false, error: '自定义参数 JSON 解析失败。' };
  }
}

export function buildSystemPromptContent(systemPrompt, thinkingMode) {
  const basePrompt = typeof systemPrompt?.content === 'string' && systemPrompt.content.trim()
    ? systemPrompt.content.trim()
    : DEFAULT_SYSTEM_PROMPT;

  if (thinkingMode === 'deep') {
    return `${basePrompt}\n\n请启用更深入的思考，优先给出完整推导。`;
  }
  if (thinkingMode === 'on') {
    return `${basePrompt}\n\n请在回答前先进行必要思考。`;
  }

  return basePrompt;
}

export function buildRequestMessages(session, contextPayload, systemPrompt, thinkingMode) {
  const cleanedHistory = session.messages
    .filter((item) => item && ['user', 'assistant'].includes(item.role))
    .map((item) => ({ role: item.role, content: item.content }));

  const systemMessages = [{
    role: 'system',
    content: buildSystemPromptContent(systemPrompt, thinkingMode),
  }];

  if (contextPayload?.text) {
    systemMessages.push({
      role: 'system',
      content: `用户草稿上下文（${contextPayload.label}）：\n${contextPayload.text}`,
    });
  }

  return [...systemMessages, ...cleanedHistory];
}

export async function parseResponseAsJson(response) {
  const rawText = await response.text();
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch {
    return { rawText };
  }
}
