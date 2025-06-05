// Standalone script to update streaming text
// stream-updater.js - A standalone script that updates streaming text elements
console.log('%c [STREAM UPDATER] Script loaded', 'background: #4CAF50; color: white; padding: 5px;');

// Create or update the global variable to store the latest streaming text
window._latestStreamingText = window._latestStreamingText || '';

// Element creation helper - creates a streaming text element if none exists
function ensureStreamingElement() {
  if (!document.getElementById('streaming-text-display')) {
    console.log('%c [STREAM UPDATER] Creating emergency streaming element', 'background: #FF9800; color: black; padding: 5px;');
    
    // Create a container for streaming text if it doesn't exist
    const container = document.createElement('div');
    container.id = 'emergency-streaming-container';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.backgroundColor = 'rgba(0,0,0,0.8)';
    container.style.color = 'white';
    container.style.padding = '10px';
    container.style.borderRadius = '5px';
    container.style.maxWidth = '300px';
    container.style.maxHeight = '200px';
    container.style.overflow = 'auto';
    
    // Create the pre element for the streaming text
    const textElement = document.createElement('pre');
    textElement.id = 'streaming-text-display';
    textElement.className = 'streaming-text';
    textElement.style.margin = '0';
    textElement.style.whiteSpace = 'pre-wrap';
    textElement.style.fontFamily = 'sans-serif';
    textElement.style.fontSize = '14px';
    textElement.innerHTML = window._latestStreamingText || 'Waiting for content...';
    
    container.appendChild(textElement);
    document.body.appendChild(container);
    return textElement;
  }
  return null;
}

// Define a function to update all streaming text elements in the DOM
window.updateStreamingElements = function() {
  // The text to display - protect against undefined
  const text = window._latestStreamingText || '';
  let updated = false;
  
  // ULTRA AGGRESSIVE ELEMENT FINDING - Try multiple strategies
  
  // Strategy 1: Direct ID selector
  const element = document.getElementById('streaming-text-display');
  if (element) {
    element.textContent = text;
    element.innerHTML = text; // Use both for maximum compatibility
    console.log('%c [STREAM UPDATER] Updated element by ID', 'background: #4CAF50; color: white;');
    updated = true;
  }
  
  // Strategy 2: Class selector
  const elements = document.getElementsByClassName('streaming-text');
  if (elements.length > 0) {
    for (let i = 0; i < elements.length; i++) {
      elements[i].textContent = text;
      elements[i].innerHTML = text;
    }
    console.log(`%c [STREAM UPDATER] Updated ${elements.length} elements by class`, 'background: #2196F3; color: white;');
    updated = true;
  }
  
  // Strategy 3: Query selector for any pre tags
  const preElements = document.querySelectorAll('pre');
  if (preElements.length > 0) {
    let preUpdated = 0;
    for (let i = 0; i < preElements.length; i++) {
      // Only update pre elements that might be for streaming (not code blocks)
      if (!preElements[i].className.includes('language-') && 
          !preElements[i].parentElement?.className.includes('code')) {
        preElements[i].textContent = text;
        preUpdated++;
      }
    }
    if (preUpdated > 0) {
      console.log(`%c [STREAM UPDATER] Updated ${preUpdated} generic pre elements`, 'background: #673AB7; color: white;');
      updated = true;
    }
  }
  
  // If no elements were found, create an emergency display element
  if (!updated && text.length > 0) {
    const newElement = ensureStreamingElement();
    if (newElement) {
      updated = true;
    }
  }
  
  // Also dispatch a custom event for any listeners
  if (text.length > 0) {
    const event = new CustomEvent('streaming-update', { detail: { text } });
    document.dispatchEvent(event);
  }
  
  return updated;
};

// Set up an interval to check for updates every 250ms (4 times per second)
window.streamingCheckInterval = setInterval(function() {
  window.updateStreamingElements();
}, 250); // More frequent updates for better responsiveness

// Listen for streaming chunks and update directly
document.addEventListener('streaming-chunk', function(e) {
  if (e.detail && e.detail.text) {
    window._latestStreamingText = e.detail.text;
    window.updateStreamingElements();
  }
});

console.log('%c [STREAM UPDATER] Periodic update interval started', 'background: #4CAF50; color: white; padding: 5px;');
