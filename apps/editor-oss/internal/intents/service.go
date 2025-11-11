package intents

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"incredible.dev/editoross/internal/models"
)

var ErrServiceDisabled = errors.New("intent service disabled")

type Service interface {
	SuggestIntent(ctx context.Context, before, after string) (models.IntentRecord, error)
}

type noopService struct{}

func NewNoopService() Service {
	return noopService{}
}

func (noopService) SuggestIntent(ctx context.Context, before, after string) (models.IntentRecord, error) {
	return models.IntentRecord{}, ErrServiceDisabled
}

type openAIService struct {
	client       *http.Client
	apiKey       string
	model        string
	organization string
}

func NewOpenAIService(apiKey, model, organization string) (Service, error) {
	if apiKey == "" {
		return nil, errors.New("apiKey is required")
	}
	if model == "" {
		model = "gpt-5-latest-advanced"
	}
	return &openAIService{
		client:       &http.Client{Timeout: 30 * time.Second},
		apiKey:       apiKey,
		model:        model,
		organization: organization,
	}, nil
}

func (s *openAIService) SuggestIntent(ctx context.Context, before, after string) (models.IntentRecord, error) {
	payload := map[string]any{
		"model": s.model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt()},
			{"role": "user", "content": buildUserPrompt(before, after)},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return models.IntentRecord{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return models.IntentRecord{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	if s.organization != "" {
		req.Header.Set("OpenAI-Organization", s.organization)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return models.IntentRecord{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return models.IntentRecord{}, fmt.Errorf("openai error: %s", strings.TrimSpace(string(raw)))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage json.RawMessage `json:"usage"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return models.IntentRecord{}, err
	}
	if len(result.Choices) == 0 {
		return models.IntentRecord{}, errors.New("no intent generated")
	}

	content := strings.TrimSpace(result.Choices[0].Message.Content)
	summary, tags := parseIntentResponse(content)
	return models.IntentRecord{
		Summary:     summary,
		Tags:        tags,
		Source:      fmt.Sprintf("openai:%s", s.model),
		UserEdited:  false,
		RawResponse: string(result.Usage),
	}, nil
}

type httpService struct {
	client  *http.Client
	baseURL string
	model   string
}

func NewHTTPService(baseURL, model string) (Service, error) {
	baseURL = strings.TrimRight(baseURL, "/")
	if baseURL == "" {
		return nil, errors.New("baseURL is required")
	}
	if model == "" {
		model = "story-intent"
	}
	return &httpService{
		client: &http.Client{
			Timeout: 20 * time.Second,
		},
		baseURL: baseURL,
		model:   model,
	}, nil
}

func (s *httpService) SuggestIntent(ctx context.Context, before, after string) (models.IntentRecord, error) {
	payload := map[string]interface{}{
		"model": s.model,
		"messages": []map[string]string{
			{
				"role":    "system",
				"content": systemPrompt(),
			},
			{
				"role":    "user",
				"content": buildUserPrompt(before, after),
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return models.IntentRecord{}, err
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		fmt.Sprintf("%s/v1/chat/completions", s.baseURL),
		bytes.NewReader(body),
	)
	if err != nil {
		return models.IntentRecord{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return models.IntentRecord{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return models.IntentRecord{}, fmt.Errorf("intent service error: %s", strings.TrimSpace(string(raw)))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage json.RawMessage `json:"usage"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return models.IntentRecord{}, err
	}
	if len(result.Choices) == 0 {
		return models.IntentRecord{}, errors.New("no intent generated")
	}

	content := strings.TrimSpace(result.Choices[0].Message.Content)
	summary, tags := parseIntentResponse(content)
	return models.IntentRecord{
		Summary:     summary,
		Tags:        tags,
		Source:      fmt.Sprintf("llm:%s", s.model),
		UserEdited:  false,
		RawResponse: string(result.Usage),
	}, nil
}

func systemPrompt() string {
	return `You are an editing intent analyst. Your job is to identify reusable editing patterns that define the author's style.

When given markdown before/after snapshots, provide:
1. A concise 1-2 sentence summary of the editing intention
2. One or more tags that categorize the edit type

Focus on HIGH-LEVEL patterns like:
- "Tightened intro by removing redundant preamble"
- "Clarified code sample with inline comments"
- "Added reader context for technical jargon"
- "Simplified sentence structure for readability"
- "Strengthened conclusion with concrete takeaway"

Available tags (use 1-3):
- clarity: Made content easier to understand
- brevity: Reduced wordiness or length
- structure: Reorganized flow or hierarchy
- tone: Adjusted voice/formality
- examples: Added/improved code samples or demonstrations
- context: Added background or explanatory detail
- formatting: Changed layout, headings, or emphasis
- correction: Fixed errors or inaccuracies

Respond in this exact format:
Summary: [your 1-2 sentence explanation]
Tags: [tag1, tag2]

Examples:

Before: "The function does something important. It works by doing several things in sequence."
After: "The function validates input by checking type, length, and format."
Summary: Replaced vague description with concrete implementation details.
Tags: clarity, specificity

Before: "First of all, let me start by saying that this is an interesting problem. There are many ways to approach it."
After: "This problem has three solutions."
Summary: Removed verbose preamble and cut directly to substance.
Tags: brevity, structure

Before: "const x = 1"
After: "const userId = 1 // Represents the logged-in user"
Summary: Renamed variable for clarity and added inline documentation.
Tags: clarity, examples`
}

func buildUserPrompt(before, after string) string {
	return fmt.Sprintf(`Original Markdown:
~~~
%s
~~~

Revised Markdown:
~~~
%s
~~~

Analyze the editing intention using the format specified.`, before, after)
}

// parseIntentResponse extracts summary and tags from the LLM response.
// Expected format:
// Summary: [text]
// Tags: [tag1, tag2, tag3]
func parseIntentResponse(content string) (summary string, tags []string) {
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "Summary:") {
			summary = strings.TrimSpace(strings.TrimPrefix(line, "Summary:"))
		} else if strings.HasPrefix(line, "Tags:") {
			tagLine := strings.TrimSpace(strings.TrimPrefix(line, "Tags:"))
			// Parse tags: "tag1, tag2" or "[tag1, tag2]"
			tagLine = strings.Trim(tagLine, "[]")
			for _, tag := range strings.Split(tagLine, ",") {
				tag = strings.TrimSpace(tag)
				if tag != "" {
					tags = append(tags, tag)
				}
			}
		}
	}

	// Fallback: if no structured format found, use entire content as summary
	if summary == "" {
		summary = content
	}

	return summary, tags
}
