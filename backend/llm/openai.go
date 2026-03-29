package llm

import (
	"context"
	"errors"
	"fmt"
	"io"

	openai "github.com/sashabaranov/go-openai"
)

type OpenAIClient struct {
	client    *openai.Client
	modelName string
}

func NewOpenAIClient(apiKey, modelName, baseURL string) *OpenAIClient {
	var client *openai.Client
	if baseURL != "" {
		cfg := openai.DefaultConfig(apiKey)
		cfg.BaseURL = baseURL
		client = openai.NewClientWithConfig(cfg)
	} else {
		client = openai.NewClient(apiKey)
	}
	return &OpenAIClient{
		client:    client,
		modelName: modelName,
	}
}

func (c *OpenAIClient) StreamChat(ctx context.Context, messages []ChatMessage, writer io.Writer) error {
	oaiMessages := make([]openai.ChatCompletionMessage, len(messages))
	for i, m := range messages {
		oaiMessages[i] = openai.ChatCompletionMessage{Role: m.Role, Content: m.Content}
	}

	stream, err := c.client.CreateChatCompletionStream(ctx, openai.ChatCompletionRequest{
		Model:    c.modelName,
		Messages: oaiMessages,
		Stream:   true,
	})
	if err != nil {
		return fmt.Errorf("openai stream error: %w", err)
	}
	defer stream.Close()

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("stream recv error: %w", err)
		}
		if len(resp.Choices) > 0 {
			_, _ = writer.Write([]byte(resp.Choices[0].Delta.Content))
		}
	}
}
