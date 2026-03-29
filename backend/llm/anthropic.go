package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type AnthropicClient struct {
	apiKey    string
	modelName string
}

func NewAnthropicClient(apiKey, modelName string) *AnthropicClient {
	return &AnthropicClient{apiKey: apiKey, modelName: modelName}
}

func (c *AnthropicClient) StreamChat(ctx context.Context, messages []ChatMessage, writer io.Writer) error {
	var systemContent string
	var convMsgs []map[string]string
	for _, m := range messages {
		if m.Role == "system" {
			systemContent = m.Content
		} else {
			convMsgs = append(convMsgs, map[string]string{"role": m.Role, "content": m.Content})
		}
	}

	reqBody, _ := json.Marshal(map[string]any{
		"model":      c.modelName,
		"max_tokens": 8192,
		"system":     systemContent,
		"messages":   convMsgs,
		"stream":     true,
	})

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(reqBody))
	if err != nil {
		return err
	}
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("anthropic request error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("anthropic API error %d: %s", resp.StatusCode, string(body))
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		var event struct {
			Type  string `json:"type"`
			Delta struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}
		if event.Type == "content_block_delta" && event.Delta.Type == "text_delta" {
			_, _ = writer.Write([]byte(event.Delta.Text))
		}
	}
	return scanner.Err()
}
