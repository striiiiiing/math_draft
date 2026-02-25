function extractTextByPartObject(part) {
  if (!part || typeof part !== 'object') return '';
  if (typeof part.text === 'string') return part.text;
  if (typeof part.content === 'string') return part.content;
  return '';
}

function extractReplyAndThinkingFromContentParts(parts) {
  if (!Array.isArray(parts)) {
    return { reply: '', thinking: '' };
  }

  let reply = '';
  let thinking = '';
  parts.forEach((part) => {
    if (typeof part === 'string') {
      reply += part;
      return;
    }

    const partType = String(part?.type || '').toLowerCase();
    const text = extractTextByPartObject(part);
    if (!text) return;

    if (['reasoning', 'thinking', 'reasoning_content', 'analysis'].includes(partType)) {
      thinking += text;
      return;
    }

    reply += text;
  });

  return { reply, thinking };
}

export function extractStreamDelta(payload) {
  if (!payload || typeof payload !== 'object') {
    return { reply: '', thinking: '' };
  }

  const streamError = payload?.error?.message || payload?.error?.detail;
  if (typeof streamError === 'string' && streamError.trim()) {
    throw new Error(streamError.trim());
  }

  let reply = '';
  let thinking = '';

  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (choice) {
    const delta = choice?.delta && typeof choice.delta === 'object' ? choice.delta : null;
    const message = choice?.message && typeof choice.message === 'object' ? choice.message : null;

    if (delta) {
      if (typeof delta.content === 'string') reply += delta.content;
      if (Array.isArray(delta.content)) {
        const chunk = extractReplyAndThinkingFromContentParts(delta.content);
        reply += chunk.reply;
        thinking += chunk.thinking;
      }
      if (typeof delta.reasoning_content === 'string') thinking += delta.reasoning_content;
      if (typeof delta.reasoning === 'string') thinking += delta.reasoning;
      if (typeof delta.thinking === 'string') thinking += delta.thinking;
    }

    if (!reply && !thinking && message) {
      if (typeof message.content === 'string') reply += message.content;
      if (Array.isArray(message.content)) {
        const chunk = extractReplyAndThinkingFromContentParts(message.content);
        reply += chunk.reply;
        thinking += chunk.thinking;
      }
      if (typeof message.reasoning_content === 'string') thinking += message.reasoning_content;
      if (typeof message.reasoning === 'string') thinking += message.reasoning;
    }
  }

  if (!reply && !thinking) {
    if (typeof payload.output_text_delta === 'string') reply += payload.output_text_delta;
    if (typeof payload.output_text === 'string') reply += payload.output_text;
    if (typeof payload.reasoning_content_delta === 'string') thinking += payload.reasoning_content_delta;
    if (typeof payload.reasoning_delta === 'string') thinking += payload.reasoning_delta;
    if (typeof payload.reasoning_content === 'string') thinking += payload.reasoning_content;
    if (typeof payload.reasoning === 'string') thinking += payload.reasoning;
  }

  return { reply, thinking };
}

function parseSseDataBlock(blockText) {
  const normalized = String(blockText || '').replace(/\r/g, '');
  if (!normalized.trim()) return '';

  const dataLines = normalized
    .split('\n')
    .map((line) => line.replace(/^\uFEFF/, ''))
    .filter((line) => line.trimStart().startsWith('data:'))
    .map((line) => line.trimStart().slice(5).trimStart());

  if (dataLines.length === 0) return '';
  return dataLines.join('\n').trim();
}

export async function consumeSseStream(response, onJsonChunk) {
  if (!response?.body || typeof response.body.getReader !== 'function') {
    return { hasDataChunk: false };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let hasDataChunk = false;

  const handleBlock = (blockText) => {
    const dataText = parseSseDataBlock(blockText);
    if (!dataText) return false;

    if (dataText === '[DONE]') {
      return true;
    }

    let payload = null;
    try {
      payload = JSON.parse(dataText);
    } catch {
      return false;
    }

    hasDataChunk = true;
    onJsonChunk(payload);
    return false;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const shouldStop = handleBlock(block);
      if (shouldStop) {
        await reader.cancel();
        return { hasDataChunk };
      }
      boundary = buffer.indexOf('\n\n');
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) handleBlock(buffer);

  return { hasDataChunk };
}
