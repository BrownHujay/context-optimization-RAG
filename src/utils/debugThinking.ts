// Debugging utility to test thinking parser
import { parseThinkingMessage } from './thinkingParser';

// Test examples to validate the parser
const testCases = [
  // Basic case
  '<think>This is my thinking process</think>Here is my final answer.',
  
  // HTML encoded case
  '&lt;think&gt;This is encoded thinking&lt;/think&gt;Here is the answer.',
  
  // Multiple think blocks
  '<think>First thought</think>Some text <think>Second thought</think>Final answer.',
  
  // Case variations
  '<Think>Mixed case thinking</Think>Answer here.',
  
  // Real-world example with newlines
  `<think>
  Let me think about this step by step:
  1. First I need to understand the question
  2. Then I need to consider the implications
  3. Finally I can provide an answer
  </think>
  
  Based on my analysis, here's my response...`,
  
  // No thinking tags
  'Just a regular response without thinking tags.',
];

export function testThinkingParser(): void {
  console.log('🧪 Testing thinking parser...');
  
  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test Case ${index + 1} ---`);
    console.log('Input:', testCase.substring(0, 100) + (testCase.length > 100 ? '...' : ''));
    
    const result = parseThinkingMessage(testCase);
    console.log('Has thinking:', result.hasThinking);
    
    if (result.hasThinking) {
      console.log('Thinking length:', result.thinkingContent?.length || 0);
      console.log('Display length:', result.displayContent.length);
      console.log('Thinking preview:', result.thinkingContent?.substring(0, 50) + '...');
    }
  });
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testThinkingParser = testThinkingParser;
}
