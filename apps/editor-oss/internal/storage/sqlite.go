package storage

import (
	"database/sql"
	"encoding/json"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"incredible.dev/editoross/internal/models"
)

type SQLiteStore struct {
	db *sql.DB
}

// NewSQLiteStore opens or creates an SQLite database and runs migrations.
func NewSQLiteStore(path string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}

	store := &SQLiteStore{db: db}
	if err := store.migrate(); err != nil {
		db.Close()
		return nil, err
	}

	// Seed demo data if database is empty
	if err := store.seedIfEmpty(); err != nil {
		db.Close()
		return nil, err
	}

	return store, nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

func (s *SQLiteStore) seedIfEmpty() error {
	var count int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM stories`).Scan(&count)
	if err != nil {
		return err
	}

	if count > 0 {
		return nil // Already has data
	}

	// Create demo story (same as memory store)
	now := time.Now().UTC()
	storyID := newID()

	story := models.Story{
		ID:        storyID,
		Title:     "Welcome to the OSS Editor",
		Summary:   "A sample storyboard demonstrating intro, code, and outro fragments.",
		CreatedAt: now,
		UpdatedAt: now,
	}

	introID := newID()
	codeID := newID()
	outroID := newID()

	intro := models.Fragment{
		ID:       introID,
		StoryID:  storyID,
		Name:     "Intro",
		Order:    0,
		Markdown: "# Hello Incredible!\nWe're rebuilding the editor with open tooling.",
		View: models.BlockView{
			Layout:      "classic",
			Mode:        "landscape",
			AspectRatio: "16:9",
			Note:        "Set the stage with a friendly greeting.",
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	code := models.Fragment{
		ID:       codeID,
		StoryID:  storyID,
		Name:     "Code Walkthrough",
		Order:    1,
		Markdown: "```ts\nconst greet = (name: string) => `Welcome ${name}!`\n```\n\nExplain how the new pipeline works while highlighting key lines.",
		View: models.BlockView{
			Layout:     "code-left",
			Mode:       "landscape",
			Theme:      "monokai",
			Animation:  "highlight",
			Highlights: []int{2},
			Note:       "Animate highlight between lines 1-2.",
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	outro := models.Fragment{
		ID:       outroID,
		StoryID:  storyID,
		Name:     "Outro",
		Order:    2,
		Markdown: "Thanks for watching! 🎬\n\nSubscribe for updates on the OSS rewrite.",
		View: models.BlockView{
			Layout:      "outro",
			Mode:        "landscape",
			AspectRatio: "16:9",
			Tags:        []string{"call-to-action"},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	story.Fragments = []models.Fragment{intro, code, outro}
	s.CreateStory(story)

	return nil
}

func (s *SQLiteStore) migrate() error {
	schema := `
CREATE TABLE IF NOT EXISTS stories (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	summary TEXT,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS fragments (
	id TEXT PRIMARY KEY,
	story_id TEXT NOT NULL,
	name TEXT NOT NULL,
	markdown TEXT,
	"order" INTEGER NOT NULL DEFAULT 0,
	view_json TEXT,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fragments_story_id ON fragments(story_id);
CREATE INDEX IF NOT EXISTS idx_fragments_order ON fragments(story_id, "order");

CREATE TABLE IF NOT EXISTS fragment_revisions (
	id TEXT PRIMARY KEY,
	story_id TEXT NOT NULL,
	fragment_id TEXT NOT NULL,
	before TEXT,
	after TEXT,
	diff TEXT,
	intent_summary TEXT,
	intent_tags TEXT,
	intent_source TEXT,
	intent_user_edited INTEGER DEFAULT 0,
	intent_raw_response TEXT,
	created_at DATETIME NOT NULL,
	FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
	FOREIGN KEY (fragment_id) REFERENCES fragments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_revisions_fragment_id ON fragment_revisions(fragment_id);
CREATE INDEX IF NOT EXISTS idx_revisions_created_at ON fragment_revisions(created_at DESC);
`
	_, err := s.db.Exec(schema)
	return err
}

// ListStories returns all stories sorted by updated_at desc.
func (s *SQLiteStore) ListStories() []models.Story {
	rows, err := s.db.Query(`
		SELECT id, title, summary, created_at, updated_at
		FROM stories
		ORDER BY updated_at DESC
	`)
	if err != nil {
		return []models.Story{}
	}
	defer rows.Close()

	var stories []models.Story
	for rows.Next() {
		var story models.Story
		var createdAt, updatedAt string
		if err := rows.Scan(&story.ID, &story.Title, &story.Summary, &createdAt, &updatedAt); err != nil {
			continue
		}
		story.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		story.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)

		// Load fragments for this story
		story.Fragments = s.loadFragmentsForStory(story.ID)
		stories = append(stories, story)
	}
	return stories
}

func (s *SQLiteStore) loadFragmentsForStory(storyID string) []models.Fragment {
	rows, err := s.db.Query(`
		SELECT id, story_id, name, markdown, "order", view_json, created_at, updated_at
		FROM fragments
		WHERE story_id = ?
		ORDER BY "order" ASC, created_at ASC
	`, storyID)
	if err != nil {
		return []models.Fragment{}
	}
	defer rows.Close()

	var fragments []models.Fragment
	for rows.Next() {
		var f models.Fragment
		var viewJSON sql.NullString
		var createdAt, updatedAt string
		if err := rows.Scan(&f.ID, &f.StoryID, &f.Name, &f.Markdown, &f.Order, &viewJSON, &createdAt, &updatedAt); err != nil {
			continue
		}
		f.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		f.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)

		if viewJSON.Valid && viewJSON.String != "" {
			json.Unmarshal([]byte(viewJSON.String), &f.View)
		}
		fragments = append(fragments, f)
	}
	return fragments
}

// GetStory retrieves a single story by ID.
func (s *SQLiteStore) GetStory(id string) (models.Story, bool) {
	var story models.Story
	var createdAt, updatedAt string
	err := s.db.QueryRow(`
		SELECT id, title, summary, created_at, updated_at
		FROM stories
		WHERE id = ?
	`, id).Scan(&story.ID, &story.Title, &story.Summary, &createdAt, &updatedAt)
	if err != nil {
		return models.Story{}, false
	}

	story.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	story.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	story.Fragments = s.loadFragmentsForStory(story.ID)
	return story, true
}

// CreateStory inserts a new story and its fragments.
func (s *SQLiteStore) CreateStory(story models.Story) models.Story {
	now := time.Now().UTC()
	if story.ID == "" {
		story.ID = newID()
	}
	story.CreatedAt = now
	story.UpdatedAt = now

	_, err := s.db.Exec(`
		INSERT INTO stories (id, title, summary, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`, story.ID, story.Title, story.Summary, now.Format(time.RFC3339), now.Format(time.RFC3339))
	if err != nil {
		return story
	}

	for i := range story.Fragments {
		if story.Fragments[i].ID == "" {
			story.Fragments[i].ID = newID()
		}
		story.Fragments[i].StoryID = story.ID
		story.Fragments[i].CreatedAt = now
		story.Fragments[i].UpdatedAt = now

		viewJSON, _ := json.Marshal(story.Fragments[i].View)
		s.db.Exec(`
			INSERT INTO fragments (id, story_id, name, markdown, "order", view_json, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, story.Fragments[i].ID, story.Fragments[i].StoryID, story.Fragments[i].Name,
			story.Fragments[i].Markdown, story.Fragments[i].Order, string(viewJSON),
			now.Format(time.RFC3339), now.Format(time.RFC3339))
	}

	return story
}

// UpdateStory replaces an existing story.
func (s *SQLiteStore) UpdateStory(story models.Story) (models.Story, error) {
	now := time.Now().UTC()
	story.UpdatedAt = now

	result, err := s.db.Exec(`
		UPDATE stories
		SET title = ?, summary = ?, updated_at = ?
		WHERE id = ?
	`, story.Title, story.Summary, now.Format(time.RFC3339), story.ID)
	if err != nil {
		return models.Story{}, err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return models.Story{}, ErrStoryNotFound
	}

	// Delete old fragments and insert new ones
	s.db.Exec(`DELETE FROM fragments WHERE story_id = ?`, story.ID)

	for i := range story.Fragments {
		if story.Fragments[i].ID == "" {
			story.Fragments[i].ID = newID()
		}
		story.Fragments[i].StoryID = story.ID
		story.Fragments[i].UpdatedAt = now

		viewJSON, _ := json.Marshal(story.Fragments[i].View)
		s.db.Exec(`
			INSERT INTO fragments (id, story_id, name, markdown, "order", view_json, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, story.Fragments[i].ID, story.Fragments[i].StoryID, story.Fragments[i].Name,
			story.Fragments[i].Markdown, story.Fragments[i].Order, string(viewJSON),
			story.Fragments[i].CreatedAt.Format(time.RFC3339), now.Format(time.RFC3339))
	}

	return story, nil
}

// DeleteStory removes a story and its fragments.
func (s *SQLiteStore) DeleteStory(id string) error {
	result, err := s.db.Exec(`DELETE FROM stories WHERE id = ?`, id)
	if err != nil {
		return err
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrStoryNotFound
	}
	return nil
}

// ListFragments returns fragments for a story.
func (s *SQLiteStore) ListFragments(storyID string) ([]models.Fragment, error) {
	// Check if story exists
	var exists int
	err := s.db.QueryRow(`SELECT 1 FROM stories WHERE id = ?`, storyID).Scan(&exists)
	if err != nil {
		return nil, ErrStoryNotFound
	}

	return s.loadFragmentsForStory(storyID), nil
}

// GetFragment retrieves a single fragment.
func (s *SQLiteStore) GetFragment(storyID, fragmentID string) (models.Fragment, error) {
	// Check if story exists
	var exists int
	err := s.db.QueryRow(`SELECT 1 FROM stories WHERE id = ?`, storyID).Scan(&exists)
	if err != nil {
		return models.Fragment{}, ErrStoryNotFound
	}

	var f models.Fragment
	var viewJSON sql.NullString
	var createdAt, updatedAt string
	err = s.db.QueryRow(`
		SELECT id, story_id, name, markdown, "order", view_json, created_at, updated_at
		FROM fragments
		WHERE id = ? AND story_id = ?
	`, fragmentID, storyID).Scan(&f.ID, &f.StoryID, &f.Name, &f.Markdown, &f.Order, &viewJSON, &createdAt, &updatedAt)
	if err != nil {
		return models.Fragment{}, ErrFragmentNotFound
	}

	f.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	f.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)

	if viewJSON.Valid && viewJSON.String != "" {
		json.Unmarshal([]byte(viewJSON.String), &f.View)
	}

	return f, nil
}

// CreateFragment adds a new fragment to a story.
func (s *SQLiteStore) CreateFragment(storyID string, fragment models.Fragment) (models.Fragment, error) {
	// Check if story exists
	var exists int
	err := s.db.QueryRow(`SELECT 1 FROM stories WHERE id = ?`, storyID).Scan(&exists)
	if err != nil {
		return models.Fragment{}, ErrStoryNotFound
	}

	now := time.Now().UTC()
	if fragment.ID == "" {
		fragment.ID = newID()
	}
	fragment.StoryID = storyID
	fragment.CreatedAt = now
	fragment.UpdatedAt = now

	// Auto-assign order if not specified
	if fragment.Order == 0 {
		var maxOrder int
		s.db.QueryRow(`SELECT COALESCE(MAX("order"), 0) FROM fragments WHERE story_id = ?`, storyID).Scan(&maxOrder)
		fragment.Order = maxOrder + 1
	}

	viewJSON, _ := json.Marshal(fragment.View)
	_, err = s.db.Exec(`
		INSERT INTO fragments (id, story_id, name, markdown, "order", view_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, fragment.ID, fragment.StoryID, fragment.Name, fragment.Markdown, fragment.Order,
		string(viewJSON), now.Format(time.RFC3339), now.Format(time.RFC3339))
	if err != nil {
		return models.Fragment{}, err
	}

	// Update story timestamp
	s.db.Exec(`UPDATE stories SET updated_at = ? WHERE id = ?`, now.Format(time.RFC3339), storyID)

	return fragment, nil
}

// UpdateFragment updates an existing fragment.
func (s *SQLiteStore) UpdateFragment(storyID string, fragment models.Fragment) (models.Fragment, error) {
	// Check if story exists
	var exists int
	err := s.db.QueryRow(`SELECT 1 FROM stories WHERE id = ?`, storyID).Scan(&exists)
	if err != nil {
		return models.Fragment{}, ErrStoryNotFound
	}

	now := time.Now().UTC()
	fragment.UpdatedAt = now

	viewJSON, _ := json.Marshal(fragment.View)
	result, err := s.db.Exec(`
		UPDATE fragments
		SET name = ?, markdown = ?, "order" = ?, view_json = ?, updated_at = ?
		WHERE id = ? AND story_id = ?
	`, fragment.Name, fragment.Markdown, fragment.Order, string(viewJSON),
		now.Format(time.RFC3339), fragment.ID, storyID)
	if err != nil {
		return models.Fragment{}, err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return models.Fragment{}, ErrFragmentNotFound
	}

	// Update story timestamp
	s.db.Exec(`UPDATE stories SET updated_at = ? WHERE id = ?`, now.Format(time.RFC3339), storyID)

	return fragment, nil
}

// DeleteFragment removes a fragment from a story.
func (s *SQLiteStore) DeleteFragment(storyID, fragmentID string) error {
	// Check if story exists
	var exists int
	err := s.db.QueryRow(`SELECT 1 FROM stories WHERE id = ?`, storyID).Scan(&exists)
	if err != nil {
		return ErrStoryNotFound
	}

	result, err := s.db.Exec(`DELETE FROM fragments WHERE id = ? AND story_id = ?`, fragmentID, storyID)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrFragmentNotFound
	}

	// Update story timestamp
	now := time.Now().UTC()
	s.db.Exec(`UPDATE stories SET updated_at = ? WHERE id = ?`, now.Format(time.RFC3339), storyID)

	return nil
}

// ListFragmentRevisions returns all revisions for a fragment.
func (s *SQLiteStore) ListFragmentRevisions(storyID, fragmentID string) ([]models.FragmentRevision, error) {
	// Check if story and fragment exist
	var exists int
	err := s.db.QueryRow(`SELECT 1 FROM stories WHERE id = ?`, storyID).Scan(&exists)
	if err != nil {
		return nil, ErrStoryNotFound
	}

	err = s.db.QueryRow(`SELECT 1 FROM fragments WHERE id = ? AND story_id = ?`, fragmentID, storyID).Scan(&exists)
	if err != nil {
		return nil, ErrFragmentNotFound
	}

	rows, err := s.db.Query(`
		SELECT id, story_id, fragment_id, before, after, diff,
			   intent_summary, intent_tags, intent_source, intent_user_edited, intent_raw_response,
			   created_at
		FROM fragment_revisions
		WHERE fragment_id = ?
		ORDER BY created_at DESC
	`, fragmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var revisions []models.FragmentRevision
	for rows.Next() {
		var r models.FragmentRevision
		var intentTags sql.NullString
		var createdAt string
		var userEdited int

		err := rows.Scan(&r.ID, &r.StoryID, &r.FragmentID, &r.Before, &r.After, &r.Diff,
			&r.Intent.Summary, &intentTags, &r.Intent.Source, &userEdited, &r.Intent.RawResponse,
			&createdAt)
		if err != nil {
			continue
		}

		r.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		r.Intent.UserEdited = userEdited == 1

		if intentTags.Valid && intentTags.String != "" {
			json.Unmarshal([]byte(intentTags.String), &r.Intent.Tags)
		}

		revisions = append(revisions, r)
	}

	return revisions, nil
}

// CreateFragmentRevision stores a new revision.
func (s *SQLiteStore) CreateFragmentRevision(storyID string, revision models.FragmentRevision) (models.FragmentRevision, error) {
	// Check if story and fragment exist
	var exists int
	err := s.db.QueryRow(`SELECT 1 FROM stories WHERE id = ?`, storyID).Scan(&exists)
	if err != nil {
		return models.FragmentRevision{}, ErrStoryNotFound
	}

	err = s.db.QueryRow(`SELECT 1 FROM fragments WHERE id = ?`, revision.FragmentID).Scan(&exists)
	if err != nil {
		return models.FragmentRevision{}, ErrFragmentNotFound
	}

	now := time.Now().UTC()
	if revision.ID == "" {
		revision.ID = newID()
	}
	revision.StoryID = storyID
	revision.CreatedAt = now

	userEdited := 0
	if revision.Intent.UserEdited {
		userEdited = 1
	}

	intentTagsJSON, _ := json.Marshal(revision.Intent.Tags)

	_, err = s.db.Exec(`
		INSERT INTO fragment_revisions
		(id, story_id, fragment_id, before, after, diff,
		 intent_summary, intent_tags, intent_source, intent_user_edited, intent_raw_response,
		 created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, revision.ID, revision.StoryID, revision.FragmentID, revision.Before, revision.After, revision.Diff,
		revision.Intent.Summary, string(intentTagsJSON), revision.Intent.Source, userEdited, revision.Intent.RawResponse,
		now.Format(time.RFC3339))
	if err != nil {
		return models.FragmentRevision{}, err
	}

	// Update story timestamp
	s.db.Exec(`UPDATE stories SET updated_at = ? WHERE id = ?`, now.Format(time.RFC3339), storyID)

	return revision, nil
}
