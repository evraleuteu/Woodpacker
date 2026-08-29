"""Sequential-pipeline entry point — now a thin delegate to the LangGraph.

The 10-stage logic lives ONCE in :mod:`woodpacker_extraction.graph` (compiled
once, checkpointed, typed state). ``engine="pipeline"`` and ``engine="graph"``
therefore execute the same workflow; the parameter is kept for API
compatibility with existing callers (server.py, cli.py, agent.py,
relationship_builder.py).
"""

from __future__ import annotations

from typing import Any

from .assets import DocumentAsset
from .graph import ExtractionState, run_graph_extraction  # noqa: F401 (re-exported)


def run_pipeline(
    file_path: str,
    file_id: str,
    all_entries: list[Any] | None = None,
    *,
    require_answer: bool = False,
    job_id: str | None = None,
    asset: DocumentAsset | None = None,
) -> dict[str, Any]:
    """Run all extraction stages for a single file via the shared graph."""
    return run_graph_extraction(
        file_path,
        file_id,
        all_entries,
        job_id=job_id,
        context={"require_answer": require_answer},
        asset=asset,
    )


__all__ = ["run_pipeline", "run_graph_extraction", "ExtractionState"]
