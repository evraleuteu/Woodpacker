"""MinIO uploader for extracted images and media (backward-compat module).

The implementation lives in :mod:`woodpacker_extraction.minio_client`;
this module re-exports it so that ``from woodpacker_extraction.minio_uploader
import MinIOUploader`` keeps working.

Usage:
    from woodpacker_extraction.minio_client import upload_image, MinIOUploader

    uploader = MinIOUploader()
    image_url = uploader.upload_image(image_data, "course-123", "img_001.png")
"""

from __future__ import annotations

from woodpacker_extraction.minio_client import (  # noqa: F401
    MinIOUploader,
    upload_image,
    upload_images_to_minio,
)

__all__ = ["MinIOUploader", "upload_image", "upload_images_to_minio"]