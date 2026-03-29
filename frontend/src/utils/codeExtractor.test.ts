import { describe, it, expect } from 'vitest';
import { extractCodeFromMarkdown } from './codeExtractor';

describe('extractCodeFromMarkdown', () => {
  it('extracts html code block', () => {
    const md = 'Here is the app:\n```html\n<h1>Hello</h1>\n```';
    expect(extractCodeFromMarkdown(md)).toBe('<h1>Hello</h1>');
  });

  it('returns null when no code block', () => {
    expect(extractCodeFromMarkdown('just text')).toBeNull();
  });

  it('extracts jsx block', () => {
    const md = '```jsx\nconst App = () => <div>Hi</div>;\n```';
    expect(extractCodeFromMarkdown(md)).toContain('const App');
  });

  it('handles code with internal newlines', () => {
    const md = '```html\n<div>\n  <p>test</p>\n</div>\n```';
    expect(extractCodeFromMarkdown(md)).toContain('<p>test</p>');
  });
});
