import { AI_CONTEXT_MODE_SET, AI_THINKING_MODE_SET, DEFAULT_SYSTEM_PROMPT } from './aiAssistant/constants';
import { clipText, createAiEndpoint, createAiMessage, createAiSession, createAiSystemPrompt } from './aiAssistant/entities';
import { buildChatCompletionUrl, buildRequestMessages, parseCustomParams, parseResponseAsJson } from './aiAssistant/request';
import { extractAssistantReply, extractAssistantThinking, mergeReplyAndThinking } from './aiAssistant/response';
import { consumeSseStream, extractStreamDelta } from './aiAssistant/stream';

export function createAiAssistantActions(ctx) {
  const {
    aiSessions,
    activeAiSessionId,
    aiPromptDraft,
    aiEndpoints,
    activeAiEndpointId,
    aiSystemPrompts,
    activeAiSystemPromptId,
    aiContextMode,
    aiThinkingMode,
    aiIsRequesting,
    aiLastError,
    resolveAiContextPayload,
  } = ctx;

  function getSessionById(sessionId) {
    return aiSessions.value.find((item) => item.id === sessionId) || null;
  }

  function getActiveSession() {
    return getSessionById(activeAiSessionId.value);
  }

  function getActiveEndpoint() {
    return aiEndpoints.value.find((item) => item.id === activeAiEndpointId.value) || null;
  }

  function getActiveSystemPrompt() {
    return aiSystemPrompts.value.find((item) => item.id === activeAiSystemPromptId.value) || null;
  }

  function ensureActiveSession() {
    const current = getActiveSession();
    if (current) return current;
    const fallback = createAiSession(ctx);
    aiSessions.value.unshift(fallback);
    activeAiSessionId.value = fallback.id;
    return fallback;
  }

  function createAiSessionAction(name = '') {
    const session = createAiSession(ctx, name);
    aiSessions.value.unshift(session);
    activeAiSessionId.value = session.id;
    aiLastError.value = '';
  }

  function deleteAiSession(sessionId) {
    const target = getSessionById(sessionId);
    if (!target) return;
    if (!window.confirm(`确认删除会话「${target.name}」吗？`)) return;

    const index = aiSessions.value.findIndex((item) => item.id === sessionId);
    aiSessions.value.splice(index, 1);

    if (aiSessions.value.length === 0) {
      createAiSessionAction();
      return;
    }

    if (activeAiSessionId.value === sessionId) {
      const fallback = aiSessions.value[index] || aiSessions.value[index - 1] || aiSessions.value[0];
      activeAiSessionId.value = fallback?.id || aiSessions.value[0].id;
    }
  }

  function selectAiSession(sessionId) {
    if (!getSessionById(sessionId)) return;
    activeAiSessionId.value = sessionId;
    aiLastError.value = '';
  }

  function ensureSessionTitle(session, userPrompt) {
    if (!session) return;
    const userCount = session.messages.filter((item) => item.role === 'user').length;
    if (userCount !== 1) return;
    if (!session.name.startsWith('新会话')) return;
    session.name = clipText(userPrompt) || session.name;
  }

  function updateAiMessage(sessionId, messageId, nextContent) {
    const session = getSessionById(sessionId);
    if (!session) return false;
    const message = session.messages.find((item) => item.id === messageId);
    if (!message) return false;

    const trimmed = String(nextContent || '').trim();
    if (!trimmed) {
      window.alert('消息内容不能为空。');
      return false;
    }

    message.content = trimmed;
    session.updatedAt = ctx.nowIso();
    aiLastError.value = '';
    return true;
  }

  function deleteAiMessage(sessionId, messageId) {
    const session = getSessionById(sessionId);
    if (!session) return;
    const target = session.messages.find((item) => item.id === messageId);
    if (!target) return;
    if (!window.confirm('确认删除这条消息吗？')) return;

    session.messages = session.messages.filter((item) => item.id !== messageId);
    session.updatedAt = ctx.nowIso();
    aiLastError.value = '';
  }

  function setAiContextMode(mode) {
    if (!AI_CONTEXT_MODE_SET.has(mode)) return;
    aiContextMode.value = mode;
  }

  function setAiThinkingMode(mode) {
    if (!AI_THINKING_MODE_SET.has(mode)) return;
    aiThinkingMode.value = mode;
  }

  function selectAiEndpoint(endpointId) {
    const target = aiEndpoints.value.find((item) => item.id === endpointId);
    if (!target) return;
    activeAiEndpointId.value = target.id;
  }

  function addAiEndpoint() {
    const current = getActiveEndpoint();
    const endpoint = createAiEndpoint(ctx, {
      name: current ? `${current.name} 副本` : '',
      baseUrl: current?.baseUrl || 'https://api.openai.com/v1',
      model: current?.model || 'gpt-4o-mini',
      apiKey: current?.apiKey || '',
      customParams: current?.customParams || '',
    });
    aiEndpoints.value.unshift(endpoint);
    activeAiEndpointId.value = endpoint.id;
  }

  function removeAiEndpoint(endpointId) {
    const target = aiEndpoints.value.find((item) => item.id === endpointId);
    if (!target) return;
    if (!window.confirm(`确认删除 API 节点「${target.name}」吗？`)) return;

    const index = aiEndpoints.value.findIndex((item) => item.id === endpointId);
    aiEndpoints.value.splice(index, 1);

    if (aiEndpoints.value.length === 0) {
      const fallback = createAiEndpoint(ctx);
      aiEndpoints.value.push(fallback);
      activeAiEndpointId.value = fallback.id;
      return;
    }

    if (activeAiEndpointId.value === endpointId) {
      const fallback = aiEndpoints.value[index] || aiEndpoints.value[index - 1] || aiEndpoints.value[0];
      activeAiEndpointId.value = fallback?.id || aiEndpoints.value[0].id;
    }
  }

  function updateAiEndpointField(endpointId, field, value) {
    const endpoint = aiEndpoints.value.find((item) => item.id === endpointId);
    if (!endpoint) return;
    if (!['name', 'baseUrl', 'model', 'apiKey', 'customParams'].includes(field)) return;
    endpoint[field] = typeof value === 'string' ? value : '';
  }

  function selectAiSystemPrompt(promptId) {
    const target = aiSystemPrompts.value.find((item) => item.id === promptId);
    if (!target) return;
    activeAiSystemPromptId.value = target.id;
  }

  function createAiSystemPromptAction() {
    const prompt = createAiSystemPrompt(ctx, {
      name: `提示词 ${aiSystemPrompts.value.length + 1}`,
      content: DEFAULT_SYSTEM_PROMPT,
    });
    aiSystemPrompts.value.unshift(prompt);
    activeAiSystemPromptId.value = prompt.id;
  }

  function removeAiSystemPrompt(promptId) {
    const target = aiSystemPrompts.value.find((item) => item.id === promptId);
    if (!target) return;
    if (!window.confirm(`确认删除系统提示词「${target.name}」吗？`)) return;

    const index = aiSystemPrompts.value.findIndex((item) => item.id === promptId);
    aiSystemPrompts.value.splice(index, 1);
    if (aiSystemPrompts.value.length === 0) {
      const fallback = createAiSystemPrompt(ctx);
      aiSystemPrompts.value.push(fallback);
      activeAiSystemPromptId.value = fallback.id;
      return;
    }

    if (activeAiSystemPromptId.value === promptId) {
      const fallback = aiSystemPrompts.value[index] || aiSystemPrompts.value[index - 1] || aiSystemPrompts.value[0];
      activeAiSystemPromptId.value = fallback?.id || aiSystemPrompts.value[0].id;
    }
  }

  function updateAiSystemPromptField(promptId, field, value) {
    const prompt = aiSystemPrompts.value.find((item) => item.id === promptId);
    if (!prompt) return;
    if (!['name', 'content'].includes(field)) return;
    prompt[field] = typeof value === 'string' ? value : '';
  }

  async function requestAssistantReply(session) {
    const endpoint = getActiveEndpoint();
    if (!endpoint) {
      aiLastError.value = '没有可用的 API 节点。';
      return false;
    }

    const model = String(endpoint.model || '').trim();
    if (!model) {
      aiLastError.value = '请先填写模型名称。';
      return false;
    }

    const endpointUrl = buildChatCompletionUrl(endpoint.baseUrl);
    if (!endpointUrl) {
      aiLastError.value = '请先填写可用的 API URL。';
      return false;
    }

    const contextPayload = resolveAiContextPayload(aiContextMode.value);
    if (!contextPayload.ok) {
      aiLastError.value = contextPayload.error || '上下文读取失败。';
      return false;
    }

    const customParamsResult = parseCustomParams(endpoint.customParams);
    if (!customParamsResult.ok) {
      aiLastError.value = customParamsResult.error;
      return false;
    }

    const systemPrompt = getActiveSystemPrompt();
    const messages = buildRequestMessages(session, contextPayload, systemPrompt, aiThinkingMode.value);

    const requestBody = {
      model,
      messages,
      ...customParamsResult.params,
      stream: true,
    };
    if (aiThinkingMode.value !== 'off') {
      requestBody.enable_thinking = true;
    }

    aiIsRequesting.value = true;
    aiLastError.value = '';

    const assistantMessage = createAiMessage(ctx, 'assistant', '');
    const assistantMessageId = assistantMessage.id;
    session.messages.push(assistantMessage);
    session.updatedAt = ctx.nowIso();

    function readAssistantMessageContent() {
      const index = session.messages.findIndex((item) => item.id === assistantMessageId);
      if (index < 0) return '';
      return String(session.messages[index]?.content || '');
    }

    function writeAssistantMessageContent(content) {
      const index = session.messages.findIndex((item) => item.id === assistantMessageId);
      if (index < 0) return false;
      const current = session.messages[index] || {};
      session.messages[index] = {
        ...current,
        content: String(content || ''),
      };
      return true;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      const token = String(endpoint.apiKey || '').trim();
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const payload = await parseResponseAsJson(response);
        const message = payload?.error?.message || payload?.message || payload?.rawText || `请求失败（HTTP ${response.status}）`;
        throw new Error(message);
      }

      let replyBuffer = '';
      let thinkingBuffer = '';
      let hasMergedFromStream = false;

      if (response.body && typeof response.clone === 'function') {
        const fallbackResponse = response.clone();
        await consumeSseStream(response, (chunkPayload) => {
          const delta = extractStreamDelta(chunkPayload);
          if (delta.reply) replyBuffer += delta.reply;
          if (delta.thinking) thinkingBuffer += delta.thinking;

          const merged = mergeReplyAndThinking(replyBuffer, thinkingBuffer);
          if (!merged) return;
          if (writeAssistantMessageContent(merged)) {
            hasMergedFromStream = true;
          }
        });

        if (!hasMergedFromStream) {
          const payload = await parseResponseAsJson(fallbackResponse);
          const reply = extractAssistantReply(payload);
          const thinking = extractAssistantThinking(payload);
          const merged = mergeReplyAndThinking(reply, thinking);
          if (merged && writeAssistantMessageContent(merged)) {
            hasMergedFromStream = true;
          }
        }
      } else {
        const payload = await parseResponseAsJson(response);
        const reply = extractAssistantReply(payload);
        const thinking = extractAssistantThinking(payload);
        const merged = mergeReplyAndThinking(reply, thinking);
        if (merged && writeAssistantMessageContent(merged)) {
          hasMergedFromStream = true;
        }
      }

      if (!hasMergedFromStream || !readAssistantMessageContent().trim()) {
        throw new Error('API 返回成功，但没有可解析的回复内容。');
      }

      session.updatedAt = ctx.nowIso();
      return true;
    } catch (error) {
      if (!readAssistantMessageContent().trim()) {
        session.messages = session.messages.filter((item) => item.id !== assistantMessageId);
      }
      session.updatedAt = ctx.nowIso();
      aiLastError.value = `请求失败：${error?.message || '未知错误'}`;
      return false;
    } finally {
      aiIsRequesting.value = false;
    }
  }

  async function sendAiPrompt() {
    if (aiIsRequesting.value) return false;
    const prompt = String(aiPromptDraft.value || '').trim();
    if (!prompt) return false;

    const session = ensureActiveSession();
    session.messages.push(createAiMessage(ctx, 'user', prompt));
    session.updatedAt = ctx.nowIso();
    ensureSessionTitle(session, prompt);
    aiPromptDraft.value = '';
    return requestAssistantReply(session);
  }

  async function retryAiMessage(sessionId, messageId) {
    if (aiIsRequesting.value) return false;

    const session = getSessionById(sessionId);
    if (!session) return false;

    const targetIndex = session.messages.findIndex((item) => item.id === messageId);
    if (targetIndex < 0) return false;

    const target = session.messages[targetIndex];
    if (target.role !== 'user') {
      aiLastError.value = '只能对提问消息执行重试。';
      return false;
    }

    session.messages = session.messages.slice(0, targetIndex + 1);
    session.updatedAt = ctx.nowIso();
    return requestAssistantReply(session);
  }

  return {
    createAiSessionAction,
    deleteAiSession,
    selectAiSession,
    updateAiMessage,
    deleteAiMessage,
    sendAiPrompt,
    retryAiMessage,
    setAiContextMode,
    setAiThinkingMode,
    selectAiEndpoint,
    addAiEndpoint,
    removeAiEndpoint,
    updateAiEndpointField,
    selectAiSystemPrompt,
    createAiSystemPromptAction,
    removeAiSystemPrompt,
    updateAiSystemPromptField,
  };
}
