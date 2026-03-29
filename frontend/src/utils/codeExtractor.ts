/**
 * 从 Markdown 文本中提取第一个 ```html / ```jsx / ```js 代码块的内容
 */
export function extractCodeFromMarkdown(markdown: string): string | null {
  const regex = /```(?:html|jsx?)\s*\n?([\s\S]*?)```/;
  const match = markdown.match(regex);
  return match ? match[1].trim() : null;
}
