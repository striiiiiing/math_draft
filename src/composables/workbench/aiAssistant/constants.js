export const AI_CONTEXT_MODE_SET = new Set(['none', 'current-flow', 'selected-lines', 'whole-notebook']);
export const AI_THINKING_MODE_SET = new Set(['off', 'on']);

export const DEFAULT_SYSTEM_PROMPT = [
  '你是数学推导助手。',
  '回答应清晰、分步骤，并优先结合用户草稿上下文。',
  '如果上下文不足，请明确提示用户补充。',
].join('\n');
