"""MinIO client for extracted images and media.

Stage 3 / 5: extract media, store it in MinIO, keep only references in
PostgreSQL (see the LessonMaterialFile.object_key / minio_bucket columns).

Usage:
    from woodpacker_extraction.minio_client import MinIOUploader

    uploader = MinIOUploader()
    key = uploader.upload_bytes(data, "course-123/images/img_001.png", "image/png")
    url = uploader.get_presigned_url(key)
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


class MinIOUploader:
    """Upload extracted images and media to MinIO object storage."""

    def __init__(
        self,
        endpoint: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        bucket: str = "woodpacker-files",
    ):
        self.endpoint = endpoint or os.environ.get("MINIO_ENDPOINT", "localhost:9000")
        self.access_key = access_key or os.environ.get("MINIO_ROOT_USER", "woodpacker")
        self.secret_key = secret_key or os.environ.get("MINIO_ROOT_PASSWORD", "woodpacker_minio_password")
        self.bucket = bucket
        self._client = None

    def _get_client(self):
        if self._client is None:
            from minio import Minio

            use_ssl = os.environ.get("MINIO_USE_SSL", "false").lower() == "true"
            self._client = Minio(
                self.endpoint,
                access_key=self.access_key,
                secret_key=self.secret_key,
                secure=use_ssl,
            )
        return self._client

    def _ensure_bucket(self):
        client = self._get_client()
        if not client.bucket_exists(self.bucket):
            client.make_bucket(self.bucket)

    def upload_bytes(
        self,
        data: bytes,
        object_key: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload raw bytes to MinIO and return the object key."""
        import io

        client = self._get_client()
        self._ensure_bucket()
        client.put_object(
            self.bucket,
            object_key,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
        return object_key

    def upload_file(
        self,
        file_path: str,
        object_key: str,
        content_type: Optional[str] = None,
    ) -> str:
        """Upload a local file to MinIO and return the object key."""
        import mimetypes

        client = self._get_client()
        self._ensure_bucket()
        content_type = content_type or mimetypes.guess_type(file_path)[0] or "application/octet-stream"
        client.fput_object(self.bucket, object_key, file_path, content_type=content_type)
        return object_key

    def upload_image(
        self,
        image_data: bytes,
        course_id: str,
        image_name: str,
    ) -> str:
        """Upload an image to MinIO and return the object key.

        Returns:
            Object key (e.g., "course-123/images/img_001.png").
        """
        object_key = f"{course_id}/images/{image_name}"
        content_type = "image/png" if image_name.endswith(".png") else "image/jpeg"
        return self.upload_bytes(image_data, object_key, content_type)

    def upload_batch(
        self,
        items: list[tuple[bytes, str]],
        course_id: str,
    ) -> list[str]:
        """Upload multiple (bytes, filename) pairs and return their object keys."""
        keys = []
        for data, name in items:
            key = self.upload_image(data, course_id, name)
            keys.append(key)
        return keys

    def get_presigned_url(self, object_key: str, expires_seconds: int = 3600) -> str:
        """Generate a presigned URL for temporary access to an object."""
        from datetime import timedelta

        client = self._get_client()
        return client.presigned_get_object(self.bucket, object_key, timedelta(seconds=expires_seconds))


def upload_image(image_data: bytes, course_id: str, image_name: str) -> str:
    """Module-level convenience: upload a single image."""
    return MinIOUploader().upload_image(image_data, course_id, image_name)


def upload_images_to_minio(images: list, course_id: str = "") -> list[dict]:
    """Convenience function: upload a list of ExtractedImage to MinIO.

    ExtractedImage instances carry metadata only (no bytes), so they are
    registered with a presigned URL only when their bytes are available;
    otherwise the object key is still recorded for later backfill.
    """
    try:
        uploader = MinIOUploader()
    except Exception as exc:  # noqa: BLE001
        logger.warning("MinIO unavailable: %s", exc)
        return []

    results = []
    for img in images:
        try:
            image_id = getattr(img, "image_id", None) or getattr(img, "id", None)
            ext = getattr(img, "ext", "png") or "png"
            page = getattr(img, "page", 0)
            bbox = list(getattr(img, "bbox", []))
            name = f"{image_id}.{ext}"
            object_key = f"{course_id}/images/{name}"
            data = getattr(img, "data", None)
            if data:
                object_key = uploader.upload_image(data, course_id, name)
            results.append({
                "image_id": image_id,
                "page": page,
                "bbox": bbox,
                "ext": ext,
                "object_key": object_key,
                "url": uploader.get_presigned_url(object_key),
            })
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to upload image %s: %s", getattr(img, "image_id", "?"), exc)

    return results