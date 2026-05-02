package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	fmt.Println("Nodi server starting...")

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Nodi is running!")
	})

	log.Println("Listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}