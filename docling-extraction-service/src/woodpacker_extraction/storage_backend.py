"""Storage abstraction (Phase 17): application logic never touches MinIO SDK
directly. Two implementations share one protocol:

* MinioStorage — current self-hosted object storage (default)
* R2Storage   — Cloudflare R2 (S3-compatible); enabled by STORAGE_BACKEND=r2

Target key hierarchy (content-addressed, immutable originals):

    {bucket}/courses/{course_id}/source/{file_id}/{sha256}_{filename}
    {bucket}/courses/{course_id}/text/{file_id}.json
    {bucket}/courses/{course_id}/images/{file_id}/{image_id}.{ext}
    {bucket}/courses/{course_id}/exercises/{material_id}.json
    {bucket}/courses/{course_id}/solutions/{file_id}.json
    {bucket}/courses/{course_id}/audio|video/...
    {bucket}/tmp/incomplete/{upload_id}/...
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Protocol

logger = logging.getLogger(__name__)

DEFAULT_BUCKET = os.environ.get("MINIO_BUCKET", "woodpacker-files")

# Only keys under these prefixes may be read by the extraction service
# (defense against arbitrary-object access via API inputs).
READABLE_PREFIXES = ("courses/", "uploads/", "text/", "exercises/")


def course_key(course_id: str, *parts: str) -> str:
    return "/".join(["courses", course_id or "_", *[p.strip("/") for p in parts if p]])


class StorageService(Protocol):
    def put_bytes(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str: ...
    def get_bytes(self, key: str) -> bytes | None: ...
    def exists(self, key: str) -> bool: ...


class MinioStorage:
    """MinIO implementation (also the base for any S3-compatible endpoint)."""

    def __init__(
        self,
        endpoint: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
        bucket: str = DEFAULT_BUCKET,
        secure: bool | None = None,
    ):
        self.endpoint = endpoint or os.environ.get("MINIO_ENDPOINT", "localhost:9000")
        self.access_key = access_key or os.environ.get("MINIO_ROOT_USER", "woodpacker")
        self.secret_key = secret_key or os.environ.get("MINIO_ROOT_PASSWORD", "woodpacker_minio_password")
        self.bucket = bucket
        if secure is None:
            secure = os.environ.get("MINIO_USE_SSL", "false").lower() == "true"
        self.secure = secure
        self._client = None

    def _get_client(self):
        if self._client is None:
            from minio import Minio

            self._client = Minio(
                self.endpoint,
                access_key=self.access_key,
                secret_key=self.secret_key,
                secure=self.secure,
            )
        return self._client

    def _ensure_bucket(self) -> None:
        client = self._get_client()
        if not client.bucket_exists(self.bucket):
            client.make_bucket(self.bucket)

    def put_bytes(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        import io

        client = self._get_client()
        self._ensure_bucket()
        client.put_object(self.bucket, key, io.BytesIO(data), length=len(data), content_type=content_type)
        return key

    def get_bytes(self, key: str) -> bytes | None:
        from minio.error import S3Error

        client = self._get_client()
        try:
            response = client.get_object(self.bucket, key)
            try:
                return response.read()
            finally:
                response.close()
                response.release_conn()
        except S3Error as exc:
            if exc.code in ("NoSuchKey", "NoSuchObject"):
                return None
            raise

    def exists(self, key: str) -> bool:
        from minio.error import S3Error

        try:
            self._get_client().stat_object(self.bucket, key)
            return True
        except S3Error as exc:
            if exc.code in ("NoSuchKey", "NoSuchObject"):
                return False
            raise


class R2Storage(MinioStorage):
    """Cloudflare R2 — S3-compatible, so only endpoint/credentials differ."""

    def __init__(self):
        super().__init__(
            endpoint=os.environ.get("R2_ENDPOINT") or os.environ.get("R2_ACCOUNT_ID", "") + ".r2.cloudflarestorage.com",
            access_key=os.environ.get("R2_ACCESS_KEY_ID", ""),
            secret_key=os.environ.get("R2_SECRET_ACCESS_KEY", ""),
            bucket=os.environ.get("R2_BUCKET", "woodpacker-prod"),
            secure=True,
        )


_storage: StorageService | None = None


def get_storage() -> StorageService:
    """Process-wide storage backend selected by STORAGE_BACKEND env."""
    global _storage
    if _storage is None:
        backend = os.environ.get("STORAGE_BACKEND", "minio").lower()
        _storage = R2Storage() if backend == "r2" else MinioStorage()
    return _storage


def validate_readable_key(object_key: str) -> bool:
    """Guard: extraction may only read objects under known prefixes."""
    return any(object_key.startswith(p) for p in READABLE_PREFIXES)


def put_json(storage: StorageService, key: str, payload: Any) -> str:
    return storage.put_bytes(key, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json")


__all__ = [
    "StorageService",
    "MinioStorage",
    "R2Storage",
    "get_storage",
    "course_key",
    "validate_readable_key",
    "put_json",
    "DEFAULT_BUCKET",
    "READABLE_PREFIXES",
]
