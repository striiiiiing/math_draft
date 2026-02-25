export function extractAssistantReply(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (choice) {
    if (typeof choice?.message?.content === 'string' && choice.message.content.trim()) {
      return choice.message.content.trim();
    }
    if (Array.isArray(choice?.message?.content)) {
      const joined = choice.message.content
        .map((part) => {
          if (typeof part === 'string') return part;
          const partType = String(part?.type || '').toLowerCase();
          if (['reasoning', 'thinking', 'reasoning_content', 'analysis'].includes(partType)) return '';
          if (typeof part?.text === 'string') return part.text;
          if (typeof part?.content === 'string') return part.content;
          return '';
        })
        .join('\n')
        .trim();
      if (joined) return joined;
    }
    if (typeof choice?.text === 'string' && choice.text.trim()) return choice.text.trim();
  }

  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  return '';
}

export function extractAssistantThinking(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (choice) {
    if (typeof choice?.message?.reasoning_content === 'string' && choice.message.reasoning_content.trim()) {
      return choice.message.reasoning_content.trim();
    }
    if (typeof choice?.message?.reasoning === 'string' && choice.message.reasoning.trim()) {
      return choice.message.reasoning.trim();
    }
    if (Array.isArray(choice?.message?.content)) {
      const joined = choice.message.content
        .map((part) => {
          if (typeof part === 'string') return '';
          const partType = String(part?.type || '').toLowerCase();
          if (!['reasoning', 'thinking', 'reasoning_content', 'analysis'].includes(partType)) return '';
          if (typeof part?.text === 'string') return part.text;
          if (typeof part?.content === 'string') return part.content;
          return '';
        })
        .join('\n')
        .trim();
      if (joined) return joined;
    }
  }

  if (typeof payload.reasoning_content === 'string' && payload.reasoning_content.trim()) {
    return payload.reasoning_content.trim();
  }
  if (typeof payload.reasoning === 'string' && payload.reasoning.trim()) {
    return payload.reasoning.trim();
  }

  return '';
}

export function mergeReplyAndThinking(reply, thinking) {
  const safeReply = String(reply || '').trim();
  const safeThinking = String(thinking || '').trim();
  if (!safeThinking) return safeReply;
  if (/<think(?:\s+[^>]*)?>[\s\S]*?<\/think>/i.test(safeReply)) return safeReply;
  if (!safeReply) return `<think>\n${safeThinking}\n</think>`;
  return `<think>\n${safeThinking}\n</think>\n\n${safeReply}`;
}
