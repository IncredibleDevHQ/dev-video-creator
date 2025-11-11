package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"incredible.dev/editoross/internal/api"
	"incredible.dev/editoross/internal/intents"
	"incredible.dev/editoross/internal/storage"
	editorweb "incredible.dev/editoross/web"
)

func main() {
	port := os.Getenv("EDITOR_API_PORT")
	if port == "" {
		port = "8081"
	}

	// Choose storage backend
	var store api.StoryStore
	dbPath := os.Getenv("EDITOR_DB_PATH")
	if dbPath != "" {
		sqlStore, err := storage.NewSQLiteStore(dbPath)
		if err != nil {
			log.Fatalf("failed to initialize SQLite: %v", err)
		}
		defer sqlStore.Close()
		store = sqlStore
		log.Printf("Using SQLite storage at: %s", dbPath)
	} else {
		store = storage.NewMemoryStore()
		log.Printf("Using in-memory storage (data will be lost on restart)")
	}

	intentService := intents.NewNoopService()
	if apiKey := os.Getenv("OPENAI_API_KEY"); apiKey != "" {
		model := os.Getenv("OPENAI_MODEL")
		org := os.Getenv("OPENAI_ORG")
		svc, err := intents.NewOpenAIService(apiKey, model, org)
		if err != nil {
			log.Printf("WARNING: failed to initialize OpenAI intent service: %v", err)
		} else {
			intentService = svc
		}
	} else if baseURL := os.Getenv("AICHAT_BASE_URL"); baseURL != "" {
		model := os.Getenv("AICHAT_MODEL")
		svc, err := intents.NewHTTPService(baseURL, model)
		if err != nil {
			log.Printf("WARNING: failed to initialize intent service: %v", err)
		} else {
			intentService = svc
		}
	}

	server := api.NewServer(store, intentService)

	root := http.NewServeMux()
	root.Handle("/api/", withCORS(logging(server.Handler())))
	root.Handle("/", editorweb.Handler())

	log.Printf("Editor OSS API listening on http://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, root); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s in %s", r.Method, r.URL.Path, time.Since(start))
	})
}
