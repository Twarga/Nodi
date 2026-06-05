package handlers

import (
	"testing"
	"time"
)

func TestParseShareExpiry(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		wantErr  bool
		wantYear int
	}{
		{"empty", "", true, 0},
		{"rfc3339_utc", "2026-12-25T15:30:00Z", false, 2026},
		{"rfc3339_offset", "2026-12-25T15:30:00+02:00", false, 2026},
		{"datetime_local_seconds", "2026-12-25T15:30:00", false, 2026},
		{"datetime_local_minutes", "2026-12-25T15:30", false, 2026},
		{"space_separator", "2026-12-25 15:30:00", false, 2026},
		{"space_no_seconds", "2026-12-25 15:30", false, 2026},
		{"garbage", "not-a-date", true, 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseShareExpiry(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error for %q, got %v", tc.input, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error for %q: %v", tc.input, err)
			}
			if got.Year() != tc.wantYear {
				t.Fatalf("year mismatch: got %d want %d", got.Year(), tc.wantYear)
			}
			// All parsed times must be UTC; the rest of the handler
			// compares them with time.Now().UTC().
			if got.Location() != time.UTC {
				t.Fatalf("expected UTC, got %v", got.Location())
			}
		})
	}
}
