package main

import (
	"fmt"
	"log"
	"net/http"

	"nodi/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Config error: %v", err)
	}

	fmt.Printf("Nodi starting on port %s\n", cfg.Port)
	fmt.Printf("Serving files from: %s\n", cfg.Root)

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Nodi is running! Root: %s", cfg.Root)
	})

	log.Printf("Listening on :%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, mux))
}