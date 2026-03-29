package llm

import (
	"context"
	"io"
)

// ChatMessage 是发给 LLM 的消息格式
type ChatMessage struct {
	Role    string `json:"role"`    // "system" | "user" | "assistant"
	Content string `json:"content"`
}

// StreamClient 是 LLM 流式调用的统一接口
type StreamClient interface {
	StreamChat(ctx context.Context, messages []ChatMessage, writer io.Writer) error
}

// SystemPrompt 是注入给 LLM 的系统提示词
const SystemPrompt = "你是一个顶级的前端工程师（类似 Claude Artifacts）。\n" +
	"用户的需求会被发送给你，你需要思考并实现该需求。\n" +
	"请必须遵循以下规则：\n" +
	"1. 你的实现必须包含在一个完整的 HTML 文件中，包含内联的 CSS 和 JS。\n" +
	"2. 将代码包裹在 ```html 标签中。\n" +
	"3. 请确保 UI 现代、美观，可以直接运行，无需额外的外部依赖（可使用 CDN 引入 Tailwind 或 React/Vue）。\n" +
	"4. 在代码块之前，先用1-2句话简短描述你的实现思路。"

// NewClient 根据 provider 创建对应的 LLM 客户端
func NewClient(provider, apiKey, modelName string) StreamClient {
	switch provider {
	case "anthropic":
		return NewAnthropicClient(apiKey, modelName)
	default:
		return NewOpenAIClient(apiKey, modelName)
	}
}
