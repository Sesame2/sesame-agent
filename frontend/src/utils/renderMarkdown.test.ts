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

  describe('streaming (unclosed) code blocks', () => {
    it('renders unclosed code block as a proper code block (with auto-closing)', () => {
      // 流式场景：收到了 ```javascript 开头但还没收到闭合的 ```
      // fixStreamingCodeBlocks 会自动补一个闭合围栏，让代码块正确渲染
      const result = renderMarkdown(
        'Here is some code:\n\n```javascript\nconst x = 1;'
      );
      // 应该被渲染为代码块（而不是当作普通文本或渲染混乱）
      expect(result).toContain('<pre');
      expect(result).toContain('language-javascript');
      expect(result).toContain('const x = 1;');
    });

    it('renders unclosed HTML code block as code block during streaming', () => {
      const result = renderMarkdown(
        'Let me write HTML:\n\n```html\n<div class="app">\n  <h1>Hello</h1>'
      );
      expect(result).toContain('<pre');
      expect(result).toContain('language-html');
      expect(result).toContain('app');
    });

    it('correctly renders fully closed code block', () => {
      const result = renderMarkdown('```html\n<div>test</div>\n```');
      expect(result).toContain('<pre');
      expect(result).toContain('&lt;div&gt;test&lt;/div&gt;');
    });

    it('handles text followed by code with content after the code block', () => {
      // 流式场景：代码块未闭合，但后面 AI 开始写解释文字
      const result = renderMarkdown(
        '```javascript\nfunction hello() {\n  return "world";\n}\n\nHere is the explanation:'
      );
      // 解释文字不应被吃进代码框 → 需要在代码块后关闭围栏
      // fixStreamingCodeBlocks 补 ``` 后，代码块正确闭合，解释文字独立
      expect(result).toContain('<pre');
      expect(result).toContain('function hello');
      // 解释文字应该也出现在输出中
      expect(result).toContain('explanation');
    });
  });
});
