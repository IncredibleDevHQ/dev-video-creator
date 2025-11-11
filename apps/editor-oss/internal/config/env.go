package config

import (
	"bufio"
	"errors"
	"os"
	"strings"
)

var (
	ErrUnknownProvider = errors.New("unknown llm provider")
	ErrMissingModel    = errors.New("model is required")
	ErrMissingAPIKey   = errors.New("api_key is required")
)

type Provider string

const (
	ProviderOpenRouter Provider = "openrouter"
	ProviderOpenAI     Provider = "openai"
)

type LLMConfig struct {
	Provider Provider
	Model    string
	APIKey   string
}

type Config struct {
	LLM LLMConfig
}

// Load reads a very small subset of YAML/INI syntax: key: value per line.
func Load(path string) (Config, error) {
	file, err := os.Open(path)
	if err != nil {
		return Config{}, err
	}
	defer file.Close()

	cfg := Config{
		LLM: LLMConfig{
			Provider: ProviderOpenRouter,
		},
	}

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		switch strings.ToLower(key) {
		case "provider":
			cfg.LLM.Provider = Provider(strings.ToLower(value))
		case "model":
			cfg.LLM.Model = value
		case "api_key":
			cfg.LLM.APIKey = strings.Trim(value, `"'`)
		}
	}

	if err := scanner.Err(); err != nil {
		return Config{}, err
	}

	if cfg.LLM.Model == "" {
		return Config{}, ErrMissingModel
	}
	if cfg.LLM.APIKey == "" {
		return Config{}, ErrMissingAPIKey
	}

	switch cfg.LLM.Provider {
	case ProviderOpenRouter, ProviderOpenAI:
	default:
		return Config{}, ErrUnknownProvider
	}

	return cfg, nil
}
