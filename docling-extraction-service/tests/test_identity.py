"""Phase 9: stable exercise identity + fuzzy duplicate detection."""

from __future__ import annotations

from woodpacker_extraction.identity import (
    exercise_number,
    find_duplicates,
    stable_exercise_key,
    token_jaccard,
)


class TestStableKeys:
    def test_same_content_same_key(self):
        a = stable_exercise_key(
            course_id="c1", material_id="m1", chapter="3", number="5a",
            prompt="Ergänzen Sie die Sätze.", pages=[12],
        )
        b = stable_exercise_key(
            course_id="c1", material_id="m1", chapter="3", number="5a",
            prompt="Ergänzen  Sie   die Sätze.", pages=[12],  # whitespace differs
        )
        assert a == b

    def test_different_chapter_different_key(self):
        a = stable_exercise_key(material_id="m1", chapter="3", number="5", prompt="Was passt?")
        b = stable_exercise_key(material_id="m1", chapter="7", number="5", prompt="Was passt?")
        assert a != b


class TestExerciseNumbers:
    def test_german_labels(self):
        assert exercise_number("Aufgabe 5b") == "5b"
        assert exercise_number("Übung 12") == "12"
        assert exercise_number("1b) Ergänzen Sie") == "1b"

    def test_no_number(self):
        assert exercise_number("Was passt hier?") is None


class TestFuzzyDuplicates:
    def _ex(self, eid, prompt, name=None, page=None, chapter=""):
        return {"exercise_id": eid, "prompt": prompt, "name": name, "page": page, "chapter": chapter}

    def test_exact_duplicate_confirmed(self):
        exs = [
            self._ex("e1", "Ergänzen Sie die Sätze mit dem Verb.", name="Aufgabe 5", page="S. 10"),
            self._ex("e2", "Ergänzen Sie die Sätze mit dem Verb.", name="Aufgabe 5", page="S. 10"),
        ]
        out = find_duplicates(exs)
        assert out[1]["duplicate_of"] == "e1"
        assert out[1]["duplicate_confirmed"] is True
        assert not out[1].get("needs_review")

    def test_similar_same_number_is_uncertain_candidate(self):
        exs = [
            self._ex("e1", "Ergänzen Sie die Sätze mit dem richtigen Artikel.", name="Aufgabe 5", page="S. 10"),
            self._ex("e2", "Ergänzen Sie die Lücken mit dem passenden Artikel.", name="Aufgabe 5", page="S. 10"),
        ]
        out = find_duplicates(exs)
        # Similar but not identical → flagged for review, never auto-merged silently
        assert out[1].get("duplicate_of") == "e1"
        assert out[1].get("needs_review") is True

    def test_same_number_different_chapter_not_duplicate(self):
        exs = [
            self._ex("e1", "Was passt? Ordnen Sie zu.", name="Aufgabe 5", page="S. 10", chapter="3"),
            self._ex("e2", "Schreiben Sie die Sätze.", name="Aufgabe 5", page="S. 40", chapter="7"),
        ]
        out = find_duplicates(exs)
        assert all("duplicate_of" not in e for e in out)

    def test_distinct_exercises_kept(self):
        exs = [
            self._ex("e1", "Hören Sie Track 12 und kreuzen Sie an."),
            self._ex("e2", "Beschreiben Sie das Bild auf Seite 4."),
        ]
        out = find_duplicates(exs)
        assert all("duplicate_of" not in e for e in out)


class TestSimilarity:
    def test_jaccard_bounds(self):
        assert token_jaccard("Ergänzen Sie die Sätze", "Ergänzen Sie die Sätze") == 1.0
        assert token_jaccard("Ergänzen Sie die Sätze", "Completely different words here") < 0.2
