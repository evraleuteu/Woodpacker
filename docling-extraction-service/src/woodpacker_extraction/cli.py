"""Command-line interface for the Woodpacker extraction service.

Usage:
    python -m woodpacker_extraction.cli Kursbuch.pdf Ubungsbuch.pdf
    python -m woodpacker_extraction.cli Kursbuch.pdf --format graph
    python -m woodpacker_extraction.cli Kursbuch.pdf --output result.json
    python -m woodpacker_extraction.cli --build-relationships Kursbuch.pdf Ubungsbuch.pdf Audio.mp3 Loesungen.pdf --user-id USER_ID --lesson-id LESSON_ID
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _load_env() -> None:
    """Load .env from the service root or project root if present."""
    import os

    from dotenv import load_dotenv

    candidates = [
        Path(__file__).resolve().parents[2] / ".env",
        Path(__file__).resolve().parents[4] / ".env",
        Path.cwd() / ".env",
    ]
    for env_path in candidates:
        if env_path.is_file():
            load_dotenv(env_path)
            break


def _detect_file_type(filename: str) -> str | None:
    """Auto-detect file type from filename."""
    lower = filename.lower()
    type_keywords = {
        "kursbuch": ["kursbuch", "lehrbuch", "textbook", "lesson_book", "main"],
        "ubungsbuch": ["ubungsbuch", "übungsbuch", "workbook", "exercise_book", "exercises"],
        "audio": ["audio", "mp3", "wav", "m4a", "track", "cd"],
        "loesungen": ["loesung", "lösung", "solution", "answer", "key", "teacher"],
    }
    for ftype, keywords in type_keywords.items():
        if any(k in lower for k in keywords):
            return ftype
    return None


def main(argv: list[str] | None = None) -> int:
    _load_env()

    parser = argparse.ArgumentParser(
        prog="woodpacker-extract",
        description="Extract learning material structure (exercises, questions, media refs) from PDFs and text files.",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Extract command (original functionality)
    extract_parser = subparsers.add_parser("extract", help="Extract text/exercises from files")
    extract_parser.add_argument("files", nargs="+", help="PDF or text files to extract")
    extract_parser.add_argument(
        "--format",
        choices=["pipeline", "graph", "summary"],
        default="pipeline",
        help="Extraction engine: sequential pipeline (default) or LangGraph workflow",
    )
    extract_parser.add_argument("--output", "-o", help="Write JSON output to this file instead of stdout")
    extract_parser.add_argument("--indent", type=int, default=2, help="JSON indent level (default: 2)")

    # Build relationships command (new)
    rel_parser = subparsers.add_parser("build-relationships", help="Build cross-file relationships for a lesson")
    rel_parser.add_argument("files", nargs=4, help="Four files: Kursbuch, Übungsbuch, Audio, Lösungen (order auto-detected)")
    rel_parser.add_argument("--user-id", required=True, help="User ID for the lesson")
    rel_parser.add_argument("--lesson-id", required=True, help="Lesson ID (e.g., lesson-1)")
    rel_parser.add_argument("--lesson-title", default="Lesson", help="Lesson title")
    rel_parser.add_argument("--output", "-o", help="Write JSON output to this file instead of stdout")
    rel_parser.add_argument("--indent", type=int, default=2, help="JSON indent level (default: 2)")
    rel_parser.add_argument("--store", action="store_true", help="Store results in database (requires DATABASE_URL)")

    args = parser.parse_args(argv)

    if args.command == "extract" or args.command is None:
        # Backward compatibility: if no command, treat as extract
        if args.command is None:
            # Check if first arg looks like a file
            if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
                args.command = "extract"
                args.files = sys.argv[1:]
            else:
                parser.print_help()
                return 1

        results: list[dict] = []
        errors: list[dict] = []

        for i, path in enumerate(args.files):
            file_id = f"file-{i}"
            try:
                if args.format == "graph":
                    from .graph import run_graph_extraction

                    result = run_graph_extraction(path, file_id)
                else:
                    from .pipeline import run_pipeline

                    result = run_pipeline(path, file_id)
                results.append(result)
            except Exception as exc:  # noqa: BLE001
                errors.append({"file": path, "file_id": file_id, "error": str(exc)})

        output: dict = {"files": results, "errors": errors, "engine": args.format}
        payload = json.dumps(output, indent=args.indent, ensure_ascii=False)

        if args.output:
            Path(args.output).write_text(payload, encoding="utf-8")
        else:
            print(payload)

        return 1 if errors else 0

    elif args.command == "build-relationships":
        # Auto-detect file types
        file_inputs = []
        for path in args.files:
            ftype = _detect_file_type(Path(path).name)
            if not ftype:
                print(f"Error: Could not detect file type for {path}", file=sys.stderr)
                return 1
            file_inputs.append({
                "path": path,
                "file_type": ftype,
                "original_filename": Path(path).name,
                "user_id": args.user_id,
                "lesson_id": args.lesson_id,
            })

        # Check for duplicate types
        types = [f["file_type"] for f in file_inputs]
        if len(set(types)) != len(types):
            print("Error: Duplicate file types detected. Need one of each: kursbuch, ubungsbuch, audio, loesungen", file=sys.stderr)
            return 1

        required_types = {"kursbuch", "ubungsbuch", "audio", "loesungen"}
        if set(types) != required_types:
            print(f"Error: Need exactly one of each type: {required_types}. Got: {types}", file=sys.stderr)
            return 1

        # Build relationships
        try:
            from .relationship_builder import FileInput, build_relationships

            inputs = [FileInput(**f) for f in file_inputs]
            result = build_relationships(inputs, args.user_id, args.lesson_id, args.lesson_title)

            payload = json.dumps(result, indent=args.indent, ensure_ascii=False)

            if args.output:
                Path(args.output).write_text(payload, encoding="utf-8")
            else:
                print(payload)

            # Store in database if requested
            if args.store:
                import asyncio
                from .storage import store_relationships

                asyncio.run(store_relationships(args.user_id, result))
                print("Stored in database successfully", file=sys.stderr)

            return 0
        except Exception as exc:  # noqa: BLE001
            print(f"Error: {exc}", file=sys.stderr)
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())