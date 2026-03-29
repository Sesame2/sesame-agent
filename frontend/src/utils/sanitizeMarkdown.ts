/**
 * 预处理 Markdown 内容，修复流式传输中的未闭合代码块围栏。
 *
 * 问题：在 SSE 流式传输中，AI 生成的内容可能包含
 * 开头的 ```javascript 但还没有闭合的 ```。
 * react-markdown 会将未闭合围栏后面的所有内容
 * （包括非代码的解释文字）渲染进同一个代码框，
 * 导致视觉混乱。
 *
 * 解决方案：检测未闭合的围栏，在末尾临时补一个
 * 闭合的 ``` 让解析器正确渲染。流式过程中，
 * 代码块会在看到开头围栏时就被渲染为代码框，
 * 后续内容也正确显示在代码框内。
 * 当真正的闭合围栏到达时，内容自然正确。
 */

/**
 * 修复流式 Markdown 中的未闭合代码块
 * @param content 流式传输中的 Markdown 内容
 * @returns 处理后的 Markdown 内容（保证代码块围栏成对）
 */
export function fixStreamingCodeBlocks(content: string): string {
  const lines = content.split('\n');
  let fenceCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // 匹配代码块围栏：至少三个反引号开头，后面只有可选的语言标识和空白
    if (/^`{3,}\w*\s*$/.test(trimmed)) {
      fenceCount++;
    }
  }

  // 围栏数量为奇数 → 有未闭合的开头围栏，补一个闭合
  if (fenceCount % 2 !== 0) {
    return content + '\n```';
  }

  return content;
}
