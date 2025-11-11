package models

import "time"

// Story captures a collection of fragments that form a complete video narrative.
type Story struct {
	ID        string     `json:"id"`
	Title     string     `json:"title"`
	Summary   string     `json:"summary,omitempty"`
	Fragments []Fragment `json:"fragments"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

// Fragment is a logical section of the storyboard (intro, code walk-through, outro, etc.).
type Fragment struct {
	ID        string    `json:"id"`
	StoryID   string    `json:"storyId"`
	Name      string    `json:"name"`
	Markdown  string    `json:"markdown"`
	Order     int       `json:"order"`
	View      BlockView `json:"view"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// BlockView mirrors the configurable preview state shown in the canvas renderer.
type BlockView struct {
	Layout      string   `json:"layout"`
	Mode        string   `json:"mode"`
	Theme       string   `json:"theme,omitempty"`
	Animation   string   `json:"animation,omitempty"`
	Highlights  []int    `json:"highlights,omitempty"`
	Note        string   `json:"note,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	AspectRatio string   `json:"aspectRatio,omitempty"`
}
