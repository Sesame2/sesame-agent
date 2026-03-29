import { describe, it, expect } from 'vitest';
import { fixStreamingCodeBlocks } from './sanitizeMarkdown';

describe('fixStreamingCodeBlocks', () => {
  it('returns unchanged content when no fences exist', () => {
    const input = 'Hello world\n\nSome **bold** text';
    expect(fixStreamingCodeBlocks(input)).toBe(input);
  });

  it('returns unchanged content when fences are balanced', () => {
    const input = '```html\n<div>test</div>\n```';
    expect(fixStreamingCodeBlocks(input)).toBe(input);
  });

  it('appends closing fence when there is one unclosed opening fence', () => {
    const input = '```javascript\nconst x = 1;';
    const result = fixStreamingCodeBlocks(input);
    expect(result).toBe(input + '\n```');
  });

  it('appends closing fence for HTML code block during streaming', () => {
    const input = '```html\n<div class="app">\n  <h1>Hello</h1>';
    const result = fixStreamingCodeBlocks(input);
    expect(result).toBe(input + '\n```');
  });

  it('handles multiple balanced fences correctly', () => {
    const input = '```js\nconsole.log(1)\n```\n\n```html\n<div>test</div>\n```';
    expect(fixStreamingCodeBlocks(input)).toBe(input);
  });

  it('handles odd number of fences (3 fences = 1 unclosed)', () => {
    const input = '```js\nfirst\n```\n\n```html\n<div>';
    const result = fixStreamingCodeBlocks(input);
    expect(result).toBe(input + '\n```');
  });

  it('does not match inline backticks as fences', () => {
    const input = 'Use `const x = 1` here';
    expect(fixStreamingCodeBlocks(input)).toBe(input);
  });

  it('does not match fenced code blocks without newline as fences', () => {
    const input = 'Some text ```javascript still more text';
    expect(fixStreamingCodeBlocks(input)).toBe(input);
  });

  it('handles fence with language specifier and trailing whitespace', () => {
    const input = '```javascript  \nconst x = 1;';
    const result = fixStreamingCodeBlocks(input);
    expect(result).toBe(input + '\n```');
  });

  it('handles fence without language specifier', () => {
    const input = '```\nsome code here';
    const result = fixStreamingCodeBlocks(input);
    expect(result).toBe(input + '\n```');
  });
});
