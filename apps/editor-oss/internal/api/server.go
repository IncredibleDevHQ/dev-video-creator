package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"incredible.dev/editoross/internal/diff"
	"incredible.dev/editoross/internal/intents"
	"incredible.dev/editoross/internal/models"
	"incredible.dev/editoross/internal/storage"
)

// StoryStore captures the persistence requirements for story endpoints.
type StoryStore interface {
	ListStories() []models.Story
	GetStory(id string) (models.Story, bool)
	CreateStory(story models.Story) models.Story
	UpdateStory(story models.Story) (models.Story, error)
	DeleteStory(id string) error
	ListFragments(storyID string) ([]models.Fragment, error)
	GetFragment(storyID, fragmentID string) (models.Fragment, error)
	CreateFragment(storyID string, fragment models.Fragment) (models.Fragment, error)
	UpdateFragment(storyID string, fragment models.Fragment) (models.Fragment, error)
	DeleteFragment(storyID, fragmentID string) error
	ListFragmentRevisions(storyID, fragmentID string) ([]models.FragmentRevision, error)
	CreateFragmentRevision(storyID string, revision models.FragmentRevision) (models.FragmentRevision, error)
}

type revisionPreviewRequest struct {
	Before string `json:"before"`
	After  string `json:"after"`
}

type revisionPreviewResponse struct {
	SuggestedIntent models.IntentRecord `json:"suggestedIntent"`
}

type createRevisionRequest struct {
	Before string              `json:"before"`
	After  string              `json:"after"`
	Intent models.IntentRecord `json:"intent"`
}

// Server wires HTTP routes to the StoryStore.
type Server struct {
	store         StoryStore
	mux           *http.ServeMux
	intentService intents.Service
}

// NewServer constructs a Server with registered routes.
func NewServer(store StoryStore, intentService intents.Service) *Server {
	s := &Server{
		store:         store,
		mux:           http.NewServeMux(),
		intentService: intentService,
	}
	s.registerRoutes()
	return s
}

// Handler exposes the HTTP handler to the world.
func (s *Server) Handler() http.Handler {
	return s.mux
}

func (s *Server) registerRoutes() {
	s.mux.HandleFunc("/api/health", s.handleHealth)
	s.mux.HandleFunc("/api/stories", s.handleStories)
	s.mux.HandleFunc("/api/stories/", s.handleStoryByID)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleStories(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		stories := s.store.ListStories()
		writeJSON(w, http.StatusOK, stories)
	case http.MethodPost:
		var incoming models.Story
		if err := decodeJSON(r.Body, &incoming); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}

		created := s.store.CreateStory(incoming)
		writeJSON(w, http.StatusCreated, created)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleStoryByID(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/stories/")
	if path == "" {
		writeError(w, http.StatusBadRequest, "story id required")
		return
	}
	segments := strings.Split(path, "/")
	id := segments[0]

	if len(segments) > 1 {
		if segments[1] != "fragments" {
			writeError(w, http.StatusNotFound, "resource not found")
			return
		}
		s.handleFragments(w, r, id, segments[2:])
		return
	}

	switch r.Method {
	case http.MethodGet:
		story, ok := s.store.GetStory(id)
		if !ok {
			writeError(w, http.StatusNotFound, "story not found")
			return
		}
		writeJSON(w, http.StatusOK, story)
	case http.MethodPut:
		var incoming models.Story
		if err := decodeJSON(r.Body, &incoming); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		incoming.ID = id
		updated, err := s.store.UpdateStory(incoming)
		if err != nil {
			if errors.Is(err, storage.ErrStoryNotFound) {
				writeError(w, http.StatusNotFound, "story not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to update story")
			return
		}
		writeJSON(w, http.StatusOK, updated)
	case http.MethodDelete:
		if err := s.store.DeleteStory(id); err != nil {
			if errors.Is(err, storage.ErrStoryNotFound) {
				writeError(w, http.StatusNotFound, "story not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to delete story")
			return
		}
		writeJSON(w, http.StatusNoContent, nil)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleFragments(w http.ResponseWriter, r *http.Request, storyID string, rest []string) {
	if len(rest) == 0 {
		switch r.Method {
		case http.MethodGet:
			fragments, err := s.store.ListFragments(storyID)
			if err != nil {
				if errors.Is(err, storage.ErrStoryNotFound) {
					writeError(w, http.StatusNotFound, "story not found")
					return
				}
				writeError(w, http.StatusInternalServerError, "failed to list fragments")
				return
			}
			writeJSON(w, http.StatusOK, fragments)
		case http.MethodPost:
			var incoming models.Fragment
			if err := decodeJSON(r.Body, &incoming); err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			created, err := s.store.CreateFragment(storyID, incoming)
			if err != nil {
				if errors.Is(err, storage.ErrStoryNotFound) {
					writeError(w, http.StatusNotFound, "story not found")
					return
				}
				writeError(w, http.StatusInternalServerError, "failed to create fragment")
				return
			}
			writeJSON(w, http.StatusCreated, created)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
		return
	}

	fragmentID := rest[0]

	if len(rest) > 1 {
		switch rest[1] {
		case "revisions":
			s.handleFragmentRevisions(w, r, storyID, fragmentID, rest[2:])
			return
		}
	}
	switch r.Method {
	case http.MethodGet:
		fragment, err := s.store.GetFragment(storyID, fragmentID)
		if err != nil {
			if errors.Is(err, storage.ErrStoryNotFound) || errors.Is(err, storage.ErrFragmentNotFound) {
				writeError(w, http.StatusNotFound, "fragment not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to fetch fragment")
			return
		}
		writeJSON(w, http.StatusOK, fragment)
	case http.MethodPut, http.MethodPatch:
		var incoming models.Fragment
		if err := decodeJSON(r.Body, &incoming); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		incoming.ID = fragmentID
		incoming.StoryID = storyID
		updated, err := s.store.UpdateFragment(storyID, incoming)
		if err != nil {
			switch {
			case errors.Is(err, storage.ErrStoryNotFound):
				writeError(w, http.StatusNotFound, "story not found")
			case errors.Is(err, storage.ErrFragmentNotFound):
				writeError(w, http.StatusNotFound, "fragment not found")
			default:
				writeError(w, http.StatusInternalServerError, "failed to update fragment")
			}
			return
		}
		writeJSON(w, http.StatusOK, updated)
	case http.MethodDelete:
		if err := s.store.DeleteFragment(storyID, fragmentID); err != nil {
			switch {
			case errors.Is(err, storage.ErrStoryNotFound):
				writeError(w, http.StatusNotFound, "story not found")
			case errors.Is(err, storage.ErrFragmentNotFound):
				writeError(w, http.StatusNotFound, "fragment not found")
			default:
				writeError(w, http.StatusInternalServerError, "failed to delete fragment")
			}
			return
		}
		writeJSON(w, http.StatusNoContent, nil)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleFragmentRevisions(w http.ResponseWriter, r *http.Request, storyID, fragmentID string, rest []string) {
	if len(rest) == 1 && rest[0] == "preview" {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req revisionPreviewRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if strings.TrimSpace(req.Before) == "" && strings.TrimSpace(req.After) == "" {
			writeError(w, http.StatusBadRequest, "before or after content required")
			return
		}
		suggestion, err := s.intentService.SuggestIntent(r.Context(), req.Before, req.After)
		if err != nil {
			if errors.Is(err, intents.ErrServiceDisabled) {
				writeError(w, http.StatusServiceUnavailable, "intent service unavailable")
				return
			}
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, revisionPreviewResponse{SuggestedIntent: suggestion})
		return
	}

	if len(rest) > 0 {
		writeError(w, http.StatusNotFound, "resource not found")
		return
	}

	switch r.Method {
	case http.MethodGet:
		revisions, err := s.store.ListFragmentRevisions(storyID, fragmentID)
		if err != nil {
			switch {
			case errors.Is(err, storage.ErrStoryNotFound):
				writeError(w, http.StatusNotFound, "story not found")
			case errors.Is(err, storage.ErrFragmentNotFound):
				writeError(w, http.StatusNotFound, "fragment not found")
			default:
				writeError(w, http.StatusInternalServerError, "failed to list revisions")
			}
			return
		}
		writeJSON(w, http.StatusOK, revisions)
	case http.MethodPost:
		var req createRevisionRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		req.Intent.Summary = strings.TrimSpace(req.Intent.Summary)
		if req.Intent.Summary == "" {
			suggestion, err := s.intentService.SuggestIntent(r.Context(), req.Before, req.After)
			if err == nil {
				req.Intent = suggestion
				req.Intent.UserEdited = false
			} else if !errors.Is(err, intents.ErrServiceDisabled) {
				writeError(w, http.StatusBadGateway, err.Error())
				return
			}
		}
		if req.Intent.Source == "" {
			if req.Intent.UserEdited {
				req.Intent.Source = "user"
			} else {
				req.Intent.Source = "manual"
			}
		}

		fragment, err := s.store.GetFragment(storyID, fragmentID)
		if err != nil {
			switch {
			case errors.Is(err, storage.ErrStoryNotFound):
				writeError(w, http.StatusNotFound, "story not found")
			case errors.Is(err, storage.ErrFragmentNotFound):
				writeError(w, http.StatusNotFound, "fragment not found")
			default:
				writeError(w, http.StatusInternalServerError, "failed to fetch fragment")
			}
			return
		}

		updatedFragment := fragment
		updatedFragment.Markdown = req.After
		if _, err := s.store.UpdateFragment(storyID, updatedFragment); err != nil {
			switch {
			case errors.Is(err, storage.ErrStoryNotFound):
				writeError(w, http.StatusNotFound, "story not found")
			case errors.Is(err, storage.ErrFragmentNotFound):
				writeError(w, http.StatusNotFound, "fragment not found")
			default:
				writeError(w, http.StatusInternalServerError, "failed to update fragment")
			}
			return
		}

		revision := models.FragmentRevision{
			FragmentID: fragmentID,
			Before:     req.Before,
			After:      req.After,
			Diff:       diff.UnifiedLines(req.Before, req.After),
			Intent:     req.Intent,
		}

		created, err := s.store.CreateFragmentRevision(storyID, revision)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to store revision")
			return
		}
		writeJSON(w, http.StatusCreated, created)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func decodeJSON(body io.ReadCloser, dst interface{}) error {
	defer body.Close()
	data, err := io.ReadAll(body)
	if err != nil {
		return errors.New("unable to read request body")
	}
	if err := json.Unmarshal(data, dst); err != nil {
		return errors.New("invalid JSON payload")
	}
	return nil
}
