// src/utils/thinkingParser.ts

export interface ParsedMessage {
  thinkingContent?: string;
  displayContent: string;
  hasThinking: boolean;
}

/**
 * Parse a message to extract thinking content from models that use <think> tags
 * Supports: qwen, deepseek, openai, phi models
 * Simple streaming approach: everything after <think> is thinking content until </think> appears
 */
export function parseThinkingMessage(content: string): ParsedMessage {
  // Check for complete <think>...</think> tags first
  const completeThinkRegex = /<think>([\s\S]*?)<\/think>/i;
  const completeMatch = content.match(completeThinkRegex);
  
  if (completeMatch) {
    const thinkingContent = completeMatch[1].trim();
    const displayContent = content.replace(completeThinkRegex, '').trim();
    
    return {
      thinkingContent,
      displayContent,
      hasThinking: true
    };
  }
  
  // Handle streaming case: <think> exists but no closing </think> tag yet
  // Everything after <think> should be treated as thinking content during streaming
  const openThinkMatch = content.match(/^<think>([\s\S]*)$/i);
  
  if (openThinkMatch) {
    // During streaming, everything after <think> is thinking content
    // No display content until we see the closing </think> tag
    const thinkingContent = openThinkMatch[1].trim();
    
    return {
      thinkingContent,
      displayContent: '', // No display content during streaming
      hasThinking: true
    };
  }
  
  return {
    displayContent: content,
    hasThinking: false
  };
}

/**
 * Check if the message content contains thinking patterns
 */
export function hasThinkingContent(content: string): boolean {
  return /<think>[\s\S]*?<\/think>/i.test(content);
}

/**
 * Extract just the thinking content without the tags
 */
export function extractThinkingContent(content: string): string | null {
  const match = content.match(/<think>([\s\S]*?)<\/think>/i);
  return match ? match[1].trim() : null;
}

/**
 * Remove thinking content from message, leaving only display content
 */
export function removeThinkingContent(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}
