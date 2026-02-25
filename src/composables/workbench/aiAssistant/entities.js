import { DEFAULT_SYSTEM_PROMPT } from './constants';

function normalizeRole(role) {
  return role === 'assistant' ? 'assistant' : 'user';
}

function normalizeMessageContent(value) {
  return typeof value === 'string' ? value : '';
}

function toDisplaySessionName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  return name || `新会话 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
}

export function clipText(value, limit = 18) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

export function createAiMessage(ctx, role, content) {
  return {
    id: ctx.uid(),
    role: normalizeRole(role),
    content: normalizeMessageContent(content),
    createdAt: ctx.nowIso(),
  };
}

export function createAiSession(ctx, name = '') {
  const createdAt = ctx.nowIso();
  return {
    id: ctx.uid(),
    name: toDisplaySessionName(name),
    createdAt,
    updatedAt: createdAt,
    messages: [],
  };
}

export function createAiEndpoint(ctx, payload = {}) {
  return {
    id: ctx.uid(),
    name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : '默认节点',
    baseUrl: typeof payload.baseUrl === 'string' ? payload.baseUrl.trim() : 'https://api.openai.com/v1',
    model: typeof payload.model === 'string' && payload.model.trim() ? payload.model.trim() : 'gpt-4o-mini',
    apiKey: typeof payload.apiKey === 'string' ? payload.apiKey : '',
    customParams: typeof payload.customParams === 'string' ? payload.customParams : '',
  };
}

export function createAiSystemPrompt(ctx, payload = {}) {
  return {
    id: ctx.uid(),
    name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : '默认提示词',
    content: typeof payload.content === 'string' && payload.content.trim() ? payload.content : DEFAULT_SYSTEM_PROMPT,
  };
}
