import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fixStreamingCodeBlocks } from './sanitizeMarkdown';

/**
 * 将 Markdown 文本渲染为 HTML 字符串
 * 提取为独立函数以便测试和复用
 */
export function renderMarkdown(content: string): string {
  return _renderWithReactMarkdown(fixStreamingCodeBlocks(content));
}

function _renderWithReactMarkdown(content: string): string {
  // react-markdown 在 SSR / 测试中输出为字符串
  // 用 renderToStaticMarkup 来获取 HTML 字符串
  const { createElement } = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');

  const components: Components = {
    pre({ children }) {
      return createElement('pre', { className: 'code-block' }, children);
    },
    code({ className, children, ...props }) {
      // 如果有 className (language-xxx)，说明是代码块内的 code，由 pre 包裹
      // 无 className 是行内 code
      if (className) {
        return createElement('code', { className, ...props }, children);
      }
      return createElement('code', { className: 'inline-code', ...props }, children);
    },
  };

  const element = createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm],
    components,
    children: content,
  });

  return renderToStaticMarkup(element);
}
