package models

import "time"

type IntentRecord struct {
	Summary     string   `json:"summary"`
	Tags        []string `json:"tags,omitempty"`
	Source      string   `json:"source"`
	UserEdited  bool     `json:"userEdited"`
	RawResponse string   `json:"rawResponse,omitempty"`
}

type FragmentRevision struct {
	ID         string       `json:"id"`
	StoryID    string       `json:"storyId"`
	FragmentID string       `json:"fragmentId"`
	Before     string       `json:"before"`
	After      string       `json:"after"`
	Diff       string       `json:"diff"`
	Intent     IntentRecord `json:"intent"`
	CreatedAt  time.Time    `json:"createdAt"`
}
