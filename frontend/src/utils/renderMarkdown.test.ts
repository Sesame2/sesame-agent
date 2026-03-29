import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './renderMarkdown';

describe('renderMarkdown', () => {
  it('renders plain text as a paragraph', () => {
    const result = renderMarkdown('Hello world');
    expect(result).toContain('Hello world');
    expect(result).toContain('<p>');
  });

  it('renders bold text with <strong> tags', () => {
    const result = renderMarkdown('This is **bold** text');
    expect(result).toContain('<strong>');
    expect(result).toContain('bold');
  });

  it('renders italic text with <em> tags', () => {
    const result = renderMarkdown('This is *italic* text');
    expect(result).toContain('<em>');
    expect(result).toContain('italic');
  });

  it('renders inline code with <code> tag and correct styling class', () => {
    const result = renderMarkdown('Use `const x = 1` here');
    expect(result).toContain('<code');
    expect(result).toContain('const x = 1');
    expect(result).toContain('inline-code');
  });

  it('renders fenced code block as <pre><code> with correct styling', () => {
    const result = renderMarkdown('```html\n<div>test</div>\n```');
    expect(result).toContain('<pre');
    expect(result).toContain('<code');
    expect(result).toContain('code-block');
    // HTML content inside code blocks is escaped by react-markdown
    expect(result).toContain('&lt;div&gt;test&lt;/div&gt;');
  });

  it('renders fenced code block without language as plain pre/code', () => {
    const result = renderMarkdown('```\nsome code\n```');
    expect(result).toContain('<pre');
    expect(result).toContain('some code');
  });

  it('renders list items', () => {
    const result = renderMarkdown('- item 1\n- item 2');
    expect(result).toContain('<ul');
    expect(result).toContain('item 1');
    expect(result).toContain('item 2');
  });

  it('renders numbered list items', () => {
    const result = renderMarkdown('1. first\n2. second');
    expect(result).toContain('<ol');
    expect(result).toContain('first');
    expect(result).toContain('second');
  });

  it('does not nest <pre> inside <pre> for code blocks', () => {
    const result = renderMarkdown('```js\nconsole.log("hi")\n```');
    // There should be exactly one <pre tag, not nested
    const preCount = (result.match(/<pre/g) || []).length;
    expect(preCount).toBe(1);
  });

  it('renders markdown with mixed content (text + bold + code block)', () => {
    const result = renderMarkdown(
      'Here is my **approach**:\n\n1. First step\n2. Second step\n\n```html\n<h1>Hello</h1>\n```'
    );
    expect(result).toContain('<strong>approach</strong>');
    expect(result).toContain('<ol>');
    expect(result).toContain('First step');
    expect(result).toContain('&lt;h1&gt;Hello&lt;/h1&gt;');
  });
});
