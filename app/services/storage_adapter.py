# app/services/storage_adapter.py

import os
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from flask import current_app
from werkzeug.utils import secure_filename
from werkzeug.datastructures import FileStorage

class StorageAdapter(ABC):
    """Abstract interface for file storage backends."""

    @abstractmethod
    def list(self, prefix: str = '') -> list[dict]:
        pass

    @abstractmethod
    def save(self, prefix: str, file: FileStorage) -> str:
        pass

    @abstractmethod
    def make_directory(self, prefix: str, name: str) -> str:
        pass

    @abstractmethod
    def rename(self, old_path: str, new_name: str) -> str:
        pass

    @abstractmethod
    def move(self, old_path: str, dest_prefix: str) -> str:
        pass

    @abstractmethod
    def delete(self, path: str) -> None:
        pass


class LocalFSAdapter(StorageAdapter):
    """
    Local filesystem implementation.
    Defaults to MEDIA_ROOT config; falls back to app/static/ if unset.
    """

    def __init__(self, base_path: Path = None):
        # 1) Try config.MEDIA_ROOT
        cfg = current_app.config.get('MEDIA_ROOT')
        if cfg:
            base = Path(cfg)
        # 2) Or use explicit base_path
        elif base_path:
            base = Path(base_path)
        # 3) Fallback to static/
        else:
            base = Path(current_app.root_path) / 'static'

        self.base_path = base.resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _resolve(self, rel_path: str) -> Path:
        """
        Resolve a user-supplied relative path under base_path.
        Raises ValueError if outside base_path.
        """
        clean = rel_path.strip().lstrip('/')
        p = (self.base_path / clean).resolve()
        if not p.is_relative_to(self.base_path):
            raise ValueError(f"Invalid path: {rel_path}")
        return p

    def list(self, prefix: str = '') -> list[dict]:
        """List entries under prefix (files & dirs)."""
        target = self._resolve(prefix)
        if not target.exists() or not target.is_dir():
            return []
        entries = []
        with os.scandir(target) as it:
            for entry in it:
                ep = target / entry.name
                entries.append({
                    'name': entry.name,
                    'path': ep.relative_to(self.base_path).as_posix(),
                    'type': 'directory' if entry.is_dir() else 'file',
                    'size': entry.stat().st_size,
                    'modified': entry.stat().st_mtime
                })
        return entries

    def save(self, prefix: str, file: FileStorage) -> str:
        """
        Save an uploaded FileStorage under prefix.
        Returns the relative path key.
        """
        dir_path = self._resolve(prefix)
        # ensure target dir exists
        dir_path.mkdir(parents=True, exist_ok=True)

        filename = secure_filename(file.filename)
        dest = dir_path / filename
        file.save(dest)

        rel = Path(prefix.strip().lstrip('/')) / filename
        return rel.as_posix()

    def make_directory(self, prefix: str, name: str) -> str:
        """Create a new subdirectory under prefix."""
        parent = self._resolve(prefix)
        new_dir = parent / secure_filename(name)
        new_dir.mkdir(parents=True, exist_ok=False)
        return new_dir.relative_to(self.base_path).as_posix()

    def rename(self, old_path: str, new_name: str) -> str:
        """Rename file or folder at old_path to new_name."""
        src = self._resolve(old_path)
        dst = src.parent / secure_filename(new_name)
        src.rename(dst)
        return dst.relative_to(self.base_path).as_posix()

    def move(self, old_path: str, dest_prefix: str) -> str:
        """Move file/folder from old_path into dest_prefix."""
        src = self._resolve(old_path)
        dst_dir = self._resolve(dest_prefix)
        if not dst_dir.is_dir():
            raise NotADirectoryError(f"Destination not a directory: {dest_prefix}")
        dst = dst_dir / src.name
        shutil.move(src, dst)
        return dst.relative_to(self.base_path).as_posix()

    def delete(self, path: str) -> None:
        """Delete file or directory at path."""
        target = self._resolve(path)
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()
