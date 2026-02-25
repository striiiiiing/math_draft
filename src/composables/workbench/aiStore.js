import { AI_CONTEXT_MODE_SET, AI_THINKING_MODE_SET, DEFAULT_SYSTEM_PROMPT } from './aiAssistant/constants';

export function createAiStoreNormalizer(ctx) {
  const { uid, nowIso } = ctx;

  function makeDefaultAiSessionName() {
    return `新会话 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
  }

  function createDefaultAiSession(payload = {}) {
    const createdAt = nowIso();
    const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : makeDefaultAiSessionName();
    return {
      id: uid(),
      name,
      createdAt,
      updatedAt: createdAt,
      messages: [],
    };
  }

  function createDefaultAiEndpoint(payload = {}) {
    return {
      id: uid(),
      name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : '默认节点',
      baseUrl: typeof payload.baseUrl === 'string' && payload.baseUrl.trim() ? payload.baseUrl.trim() : 'https://api.openai.com/v1',
      model: typeof payload.model === 'string' && payload.model.trim() ? payload.model.trim() : 'gpt-4o-mini',
      apiKey: typeof payload.apiKey === 'string' ? payload.apiKey : '',
      customParams: typeof payload.customParams === 'string' ? payload.customParams : '',
    };
  }

  function createDefaultAiSystemPrompt(payload = {}) {
    return {
      id: uid(),
      name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : '默认提示词',
      content: typeof payload.content === 'string' && payload.content.trim() ? payload.content : DEFAULT_SYSTEM_PROMPT,
    };
  }

  function sanitizeAiMessages(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: typeof item.id === 'string' && item.id.length > 0 ? item.id : uid(),
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: typeof item.content === 'string' ? item.content : '',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : nowIso(),
      }));
  }

  function sanitizeAiSessions(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const createdAt = typeof item.createdAt === 'string' ? item.createdAt : nowIso();
        return {
          id: typeof item.id === 'string' && item.id.length > 0 ? item.id : uid(),
          name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : makeDefaultAiSessionName(),
          createdAt,
          updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : createdAt,
          messages: sanitizeAiMessages(item.messages),
        };
      });
  }

  function sanitizeAiEndpoints(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && typeof item === 'object')
      .map((item) => createDefaultAiEndpoint(item));
  }

  function sanitizeAiSystemPrompts(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && typeof item === 'object')
      .map((item) => createDefaultAiSystemPrompt(item));
  }

  function normalizeAiStore(rawValue) {
    const source = rawValue && typeof rawValue === 'object' ? rawValue : {};

    let sessions = sanitizeAiSessions(source.sessions);
    if (sessions.length === 0) sessions = [createDefaultAiSession()];

    let endpoints = sanitizeAiEndpoints(source.endpoints);
    if (endpoints.length === 0) endpoints = [createDefaultAiEndpoint()];

    let systemPrompts = sanitizeAiSystemPrompts(source.systemPrompts);
    if (systemPrompts.length === 0) systemPrompts = [createDefaultAiSystemPrompt()];

    const activeSessionId = sessions.some((item) => item.id === source.activeSessionId)
      ? source.activeSessionId
      : sessions[0].id;
    const activeEndpointId = endpoints.some((item) => item.id === source.activeEndpointId)
      ? source.activeEndpointId
      : endpoints[0].id;
    const activeSystemPromptId = systemPrompts.some((item) => item.id === source.activeSystemPromptId)
      ? source.activeSystemPromptId
      : systemPrompts[0].id;
    const contextMode = AI_CONTEXT_MODE_SET.has(source.contextMode) ? source.contextMode : 'current-flow';
    const thinkingMode = AI_THINKING_MODE_SET.has(source.thinkingMode) ? source.thinkingMode : 'off';

    return {
      sessions,
      activeSessionId,
      endpoints,
      activeEndpointId,
      systemPrompts,
      activeSystemPromptId,
      contextMode,
      thinkingMode,
    };
  }

  return {
    normalizeAiStore,
  };
}
