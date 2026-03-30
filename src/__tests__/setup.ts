import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

// React 19 doesn't export act, but @testing-library/react needs it
// Provide a wrapper that works with React 19
const React = require('react') as any;
const ReactDOM = require('react-dom') as any;

if (!React.act) {
  // Simple act wrapper that handles sync and async callbacks
  // React.flushSync is available in React 19 but needs to be called directly
  React.act = (callback: () => void | Promise<void>) => {
    let result: any;
    let error: any;

    // Wrap the callback to execute it synchronously
    const wrappedCallback = () => {
      try {
        result = callback();
      } catch (e) {
        error = e;
      }
    };

    // Use ReactDOM.flushSync if available for synchronous rendering
    if (ReactDOM.flushSync) {
      try {
        ReactDOM.flushSync(wrappedCallback);
      } catch {
        wrappedCallback();
      }
    } else {
      wrappedCallback();
    }

    if (error) throw error;

    // If result is a promise, return it, otherwise wrap in Promise.resolve
    if (result instanceof Promise) {
      return result;
    }
    return Promise.resolve(result);
  };
}

// Now we can safely import @testing-library/react
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
