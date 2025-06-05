// Using eventsource-parser to handle SSE streams
import { createParser, type EventSourceMessage } from 'eventsource-parser';

/**
 * Parse a Server-Sent Events (SSE) stream into individual text chunks
 * @param stream - The fetch response body stream
 * @yields Each text chunk from the SSE stream
 */
export async function* parseSSEStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let eventBuffer: string | null = null;
  
  // Create the SSE parser with correct callbacks object
  const parser = createParser({
    onEvent(event: EventSourceMessage) {
      try {
        // Try to parse the data as JSON
        const parsedData = JSON.parse(event.data);
        // Check if this is a text chunk
        if (parsedData.type === 'chunk' && parsedData.data?.text) {
          eventBuffer = parsedData.data.text;
        }
      } catch (e) {
        // If not valid JSON, use the raw data
        eventBuffer = event.data;
      }
    }
  });
  
  try {
    // Process the stream chunk by chunk
    while (true) {
      const { value, done } = await reader.read();
      
      if (done) break;
      
      // Decode binary chunk to text and feed it to the parser
      const chunk = decoder.decode(value, { stream: true });
      parser.feed(chunk);
      
      // If we have accumulated event data, yield it
      if (eventBuffer) {
        const text = eventBuffer;
        eventBuffer = null; // Reset for next chunk
        yield text;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Helper function to make a streaming chat request
 * @param request - The fetch request object
 * @returns The response body as a ReadableStream
 */
export async function streamChat(request: Request): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(request);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  if (!response.body) {
    throw new Error('Response body is null');
  }
  
  return response.body;
}
