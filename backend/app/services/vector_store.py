"""
TRUE FACE AI — FAISS Vector Store Service

Provides 1:N vector search and identity management using FAISS (IndexFlatIP).
Uses inner product on L2-normalized vectors for cosine similarity calculation.
Persists vectors to binary FAISS index and associated user metadata to JSON.
"""

import json
import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any

import faiss
import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)


class VectorStoreError(Exception):
    """Raised when FAISS vector store operation fails."""
    pass


class VectorStore:
    """
    FAISS-backed 1:N vector store and user metadata registry.

    Uses `faiss.IndexFlatIP` for inner product (cosine similarity on normalized vectors).

    Usage:
        store = VectorStore(dimension=512)
        idx = store.add_face("USR001", "Alice", embedding_vector)
        matches = store.search(query_vector, top_k=5)
    """

    def __init__(
        self,
        dimension: int = 512,
        index_path: str | None = None,
        metadata_path: str | None = None,
        auto_load: bool = True,
    ) -> None:
        """
        Initialize the vector store.

        Args:
            dimension: Feature vector dimensionality (e.g. 512).
            index_path: Path to FAISS binary index. Defaults to settings.faiss_index_path.
            metadata_path: Path to metadata JSON file. Defaults to settings.faiss_metadata_path.
            auto_load: Automatically load existing index and metadata files if available.
        """
        self.dimension = dimension
        self.index_path = index_path or settings.faiss_index_path
        self.metadata_path = metadata_path or settings.faiss_metadata_path
        self._lock = threading.RLock()

        # Metadata dictionary mapping str(faiss_internal_index) -> user record dict
        # Record format:
        # {
        #   "faiss_id": int,
        #   "user_id": str,
        #   "name": str,
        #   "created_at": str (ISO timestamp),
        #   "metadata": dict
        # }
        self._metadata: dict[str, dict[str, Any]] = {}
        self._next_faiss_id: int = 0

        # Create FAISS Flat Inner-Product index
        self._index = faiss.IndexFlatIP(self.dimension)

        if auto_load:
            self.load()

    def load(self) -> None:
        """Load FAISS index and metadata from storage if present."""
        with self._lock:
            index_exists = os.path.exists(self.index_path)
            meta_exists = os.path.exists(self.metadata_path)

            if index_exists and meta_exists:
                try:
                    logger.info("Loading FAISS index from %s", self.index_path)
                    loaded_index = faiss.read_index(str(self.index_path))

                    if loaded_index.d != self.dimension:
                        logger.warning(
                            "FAISS index dimension mismatch (%d != %d). Re-initializing.",
                            loaded_index.d,
                            self.dimension,
                        )
                        self._index = faiss.IndexFlatIP(self.dimension)
                        self._metadata = {}
                        self._next_faiss_id = 0
                        return

                    self._index = loaded_index

                    logger.info("Loading metadata from %s", self.metadata_path)
                    with open(self.metadata_path, "r", encoding="utf-8") as f:
                        self._metadata = json.load(f)

                    # Compute next internal FAISS ID
                    if self._metadata:
                        max_id = max(int(k) for k in self._metadata.keys())
                        self._next_faiss_id = max_id + 1
                    else:
                        self._next_faiss_id = 0

                    logger.info(
                        "Vector store loaded successfully: %d vectors in index.",
                        self._index.ntotal,
                    )
                except Exception as e:
                    logger.error("Failed to load vector store from storage: %s", e, exc_info=True)
                    # Fallback to fresh index
                    self._index = faiss.IndexFlatIP(self.dimension)
                    self._metadata = {}
                    self._next_faiss_id = 0
            else:
                logger.info("No existing vector store found at %s. Starting fresh.", self.index_path)

    def save(self) -> None:
        """Save FAISS binary index and metadata to disk."""
        with self._lock:
            try:
                # Ensure target directory exists
                os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
                os.makedirs(os.path.dirname(self.metadata_path), exist_ok=True)

                faiss.write_index(self._index, str(self.index_path))
                with open(self.metadata_path, "w", encoding="utf-8") as f:
                    json.dump(self._metadata, f, indent=2)

                logger.info(
                    "Saved vector store with %d vectors to %s and %s",
                    self._index.ntotal,
                    self.index_path,
                    self.metadata_path,
                )
            except Exception as e:
                logger.error("Failed to save vector store: %s", e, exc_info=True)
                raise VectorStoreError(f"Failed to save vector store: {e}") from e

    def add_face(
        self,
        user_id: str,
        name: str,
        embedding: np.ndarray,
        extra_metadata: dict[str, Any] | None = None,
    ) -> int:
        """
        Add a face embedding to the FAISS index and store metadata.

        Args:
            user_id: Unique user string identifier (e.g. "USR123").
            name: User full name or display name.
            embedding: 1D or 2D numpy float32 array of shape (512,).
            extra_metadata: Optional dict of arbitrary user details.

        Returns:
            Internal FAISS ID assigned to this face entry.
        """
        if embedding is None:
            raise VectorStoreError("Embedding array cannot be None.")

        # Ensure float32 2D array (1, 512) for FAISS
        vec = np.ascontiguousarray(embedding, dtype=np.float32)
        if len(vec.shape) == 1:
            vec = np.expand_dims(vec, axis=0)

        if vec.shape[1] != self.dimension:
            raise VectorStoreError(
                f"Embedding dimension mismatch: expected {self.dimension}, got {vec.shape[1]}"
            )

        # L2-normalize vector to guarantee inner product = cosine similarity
        norm = np.linalg.norm(vec, axis=1, keepdims=True)
        norm[norm == 0] = 1e-10
        vec = vec / norm

        with self._lock:
            faiss_id = self._next_faiss_id
            self._next_faiss_id += 1

            self._index.add(vec)

            record = {
                "faiss_id": faiss_id,
                "user_id": user_id,
                "name": name,
                "enrolled_at": datetime.now(timezone.utc).isoformat(),
                "extra_metadata": extra_metadata or {},
            }
            self._metadata[str(faiss_id)] = record

            # Persist on write
            self.save()

            logger.info(
                "Enrolled user '%s' (%s) with faiss_id %d. Total vectors: %d",
                name,
                user_id,
                faiss_id,
                self._index.ntotal,
            )

            return faiss_id

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int | None = None,
        threshold: float | None = None,
    ) -> list[dict[str, Any]]:
        """
        Search for top-K matching faces in the FAISS index.

        Args:
            query_embedding: 1D float32 numpy array of shape (512,).
            top_k: Number of nearest matches to return. Defaults to settings.top_k.
            threshold: Minimum cosine similarity score threshold. Defaults to settings.face_match_threshold.

        Returns:
            List of candidate match dicts:
                [
                    {
                        "user_id": "USR123",
                        "name": "Alice",
                        "similarity": 0.892,
                        "faiss_id": 0,
                        "enrolled_at": "...",
                        "extra_metadata": {}
                    },
                    ...
                ]
        """
        top_k = top_k if top_k is not None else settings.top_k
        threshold = threshold if threshold is not None else settings.face_match_threshold

        if self._index.ntotal == 0:
            logger.info("Search requested on empty FAISS vector store.")
            return []

        # Prepare query vector
        vec = np.ascontiguousarray(query_embedding, dtype=np.float32)
        if len(vec.shape) == 1:
            vec = np.expand_dims(vec, axis=0)

        # L2-normalize
        norm = np.linalg.norm(vec, axis=1, keepdims=True)
        norm[norm == 0] = 1e-10
        vec = vec / norm

        actual_k = min(top_k, self._index.ntotal)

        with self._lock:
            similarities, indices = self._index.search(vec, actual_k)

        results: list[dict[str, Any]] = []
        for sim, idx in zip(similarities[0], indices[0]):
            if idx == -1:
                continue

            sim_score = float(sim)
            record = self._metadata.get(str(idx), {})

            candidate = {
                "user_id": record.get("user_id", "UNKNOWN"),
                "name": record.get("name", "Unknown User"),
                "similarity": round(sim_score, 4),
                "faiss_id": int(idx),
                "is_match": sim_score >= threshold,
                "enrolled_at": record.get("enrolled_at", ""),
                "extra_metadata": record.get("extra_metadata", {}),
            }
            results.append(candidate)

        logger.info(
            "FAISS search executed: returned %d candidate(s) (top_k=%d, max_sim=%.4f)",
            len(results),
            top_k,
            results[0]["similarity"] if results else 0.0,
        )

        return results

    def get_all_users(self) -> list[dict[str, Any]]:
        """Return list of all enrolled user records."""
        with self._lock:
            return list(self._metadata.values())

    def get_user_by_id(self, user_id: str) -> list[dict[str, Any]]:
        """Return all enrollment records for a given user_id."""
        with self._lock:
            return [rec for rec in self._metadata.values() if rec.get("user_id") == user_id]

    def count(self) -> int:
        """Return total number of enrolled vectors."""
        with self._lock:
            return self._index.ntotal

    def reset(self) -> None:
        """Clear all vectors and metadata, and delete storage files if present."""
        with self._lock:
            self._index = faiss.IndexFlatIP(self.dimension)
            self._metadata = {}
            self._next_faiss_id = 0

            if os.path.exists(self.index_path):
                try:
                    os.remove(self.index_path)
                except OSError:
                    pass

            if os.path.exists(self.metadata_path):
                try:
                    os.remove(self.metadata_path)
                except OSError:
                    pass

            logger.info("Vector store reset complete.")


# ──────────────────────────────────────────────
# Module-level singleton for reuse across app
# ──────────────────────────────────────────────
_vector_store_instance: VectorStore | None = None


def get_vector_store() -> VectorStore:
    """
    Get or create the singleton VectorStore instance.
    Loads persistent state on first call.
    """
    global _vector_store_instance
    if _vector_store_instance is None:
        _vector_store_instance = VectorStore()
    return _vector_store_instance
