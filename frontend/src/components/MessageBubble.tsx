import { type Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../types';
import { LoadingDots } from './LoadingDots';

/**
 * Markdown 组件覆盖配置
 * 关键修复：分离 pre 和 code 的处理，避免嵌套 <pre>
 */
const markdownComponents: Components = {
  // 代码块的外层 <pre> —— 只负责容器样式
  pre({ children }) {
    return (
      <pre className="bg-gray-800 text-green-300 rounded-lg p-3 overflow-x-auto text-xs my-2">
        {children}
      </pre>
    );
  },
  // <code> —— 区分行内代码和代码块内的 code
  code({ className, children, ...props }) {
    const isBlock = Boolean(className); // 有 className 说明是代码块 (language-xxx)
    if (isBlock) {
      // 代码块内的 code，pre 已经处理了外层样式
      return <code className={className} {...props}>{children}</code>;
    }
    // 行内代码
    return (
      <code className="bg-gray-200 text-red-600 px-1 rounded text-xs" {...props}>
        {children}
      </code>
    );
  },
  // GFM 表格
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full text-xs border-collapse border border-gray-300">
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-left font-medium">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-gray-300 px-2 py-1">{children}</td>
    );
  },
  // 链接
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline hover:text-indigo-800">
        {children}
      </a>
    );
  },
  // 无序列表
  ul({ children }) {
    return <ul className="list-disc list-inside my-1 space-y-0.5">{children}</ul>;
  },
  // 有序列表
  ol({ children }) {
    return <ol className="list-decimal list-inside my-1 space-y-0.5">{children}</ol>;
  },
};

interface Props { message: Message; }

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
          AI
        </div>
      )}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-sm'
          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
      }`}>
        {message.isStreaming && message.content === '' ? (
          <LoadingDots />
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {message.content}
          </ReactMarkdown>
        )}
        {message.isStreaming && message.content !== '' && (
          <span className="inline-block w-1 h-4 bg-indigo-500 animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  );
}
