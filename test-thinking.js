// Test the thinking parser
function parseThinkingMessage(content) {
  // Check for <think> tags
  const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
  const match = content.match(thinkRegex);
  
  if (match) {
    const thinkingContent = match[1].trim();
    const displayContent = content.replace(thinkRegex, '').trim();
    
    return {
      thinkingContent,
      displayContent,
      hasThinking: true
    };
  }
  
  return {
    displayContent: content,
    hasThinking: false
  };
}

// Test with sample content that matches the format from your problem description
const sampleWithThinking = `First, the user asked me to "think thoughtfully and long before explaining." That means I should not jump straight into a response but instead take time to carefully consider my explanation. As DeepSeek, an AI assistant developed by DeepSeek company, I need to provide accurate, helpful, and thorough information without overwhelming them with jargon or simplifying too much.

The user's query is about quantum physics: "can you explain quantum physics to me?" This topic can be complex because it deals with microscopic phenomena that defy classical intuition. My response should start by acknowledging the challenge of explaining something profound like this while building trust through a calm and approachable tone.<br><br> To structure my answer, I'll begin with an introduction to what quantum physics is – perhaps comparing it to everyday experiences to make it relatable. Then break down key concepts step-by-step: starting from atoms, wave-particle duality, quantization, the uncertainty principle, superposition, entanglement, and finally how it differs from classical physics.<br><br> I should assess their scenario carefully since they explicitly asked for thoughtful consideration before explaining. They might be a beginner – maybe someone curious about science but not deeply familiar with physics terms or ideas – so I'll aim to simplify without being condescending while still providing depth where needed, ending on an encouraging note that invites further questions.<br><br> Digging deeper into their unspoken needs, the user could be seeking not just definitions but a way to grasp how quantum mechanics impacts real life. Quantum physics underpins modern technology like lasers and semiconductors, so I should subtly weave in examples of its applications or paradoxes that challenge common sense – perhaps they're trying to understand why it's counterintuitive.<br><br> Overall approach: Use an analogy for the intro (e.g., comparing quantum mechanics to a "strange new language" or something else). Then go step by step through core principles, highlight famous thought experiments like Schrödightening and double-slit. Finally, summarize how it differs from classical physics.<br><br> This way ensures clarity while fulfilling their request for depth – they might appreciate knowing the big picture before diving into specifics.<|im_end|>

Okay, let's embark on this journey into one of the most fascinating and fundamental areas of modern science: Quantum Physics. It's a field that fundamentally changed our understanding of reality at its smallest scales.`;

const sampleWithThinkTags = `<think>I need to think about this carefully. This is my thinking process.</think>This is my response to you.`;

console.log('Testing with content from problem description:');
const result1 = parseThinkingMessage(sampleWithThinking);
console.log('Has thinking:', result1.hasThinking);
console.log('Thinking content length:', result1.thinkingContent ? result1.thinkingContent.length : 0);

console.log('\nTesting with proper <think> tags:');
const result2 = parseThinkingMessage(sampleWithThinkTags);
console.log('Has thinking:', result2.hasThinking);
console.log('Thinking content:', result2.thinkingContent);
console.log('Display content:', result2.displayContent);
