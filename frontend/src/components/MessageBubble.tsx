import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';
import { LoadingDots } from './LoadingDots';

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
            components={{
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              code({ className, children, ...props }: any) {
                const isBlock = /language-/.test(className || '');
                return isBlock ? (
                  <pre className="bg-gray-800 text-green-300 rounded-lg p-3 overflow-x-auto text-xs my-2">
                    <code {...props}>{children}</code>
                  </pre>
                ) : (
                  <code className="bg-gray-200 text-red-600 px-1 rounded text-xs" {...props}>{children}</code>
                );
              },
            }}
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
