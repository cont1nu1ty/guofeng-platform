#!/usr/bin/env python3
"""Optional offline encryption for existing backups, using the installed GnuPG CLI.

No daemon, key server, credentials in arguments, raw-backup deletion or retention
cleanup. The operator keeps the random key file outside the backup/repository.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tarfile
import tempfile
import hashlib

FILES = ("database.sql", "storage.tar.gz", "secrets.env", "images.lock.json", "sha256.json")


def verify_backup(source):
    source = Path(source).resolve()
    for name in FILES:
        path = source / name
        if path.is_symlink() or not path.is_file():
            raise ValueError("Backup must contain regular files: " + name)
    manifest = json.loads((source / "sha256.json").read_text())
    for name in FILES[:-1]:
        with (source / name).open("rb") as handle:
            digest = hashlib.file_digest(handle, "sha256").hexdigest()
        if manifest.get(name) != digest:
            raise ValueError("Backup checksum mismatch: " + name)
    return source


def check_key(key_file, source_directory, destination_directory):
    key = Path(key_file)
    if key.is_symlink():
        raise ValueError("Backup key must be a private regular file, not a symlink")
    key = key.resolve()
    info = key.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError("Backup key must be owned by the current user with mode 0600 or 0400")
    # GnuPG's passphrase-file reads the first line, not the complete file.
    with key.open("rb") as handle:
        passphrase = handle.readline(4096).rstrip(b"\r\n")
    if len(passphrase) < 32:
        raise ValueError("Use a separate random backup passphrase of at least 32 bytes")
    repo = Path(__file__).resolve().parents[1]
    if key.is_relative_to(repo) or key.is_relative_to(source_directory) or key.is_relative_to(destination_directory):
        raise ValueError("Keep the decryption key outside the repository and backup/output directories")
    if shutil.which("gpg") is None:
        raise ValueError("The optional backup encryption command requires the locally installed GnuPG CLI")
    return key


def crypt(mode, source, destination, key_file):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if destination.exists():
        raise ValueError("Destination already exists; existing backup/output is never overwritten")
    source_directory = source if mode == "encrypt" else source.parent
    destination_directory = destination.parent if mode == "encrypt" else destination
    key = check_key(key_file, source_directory, destination_directory)
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Keep the complete decrypted archive private until GnuPG has verified its
    # integrity protection. Never stream unverified plaintext into an extractor.
    with tempfile.TemporaryDirectory(prefix=".jiafeng-crypto-", dir=destination.parent) as folder:
        private = Path(folder)
        plain, encrypted = private / "backup.tar", private / "backup.gpg"
        gpg = ["gpg", "--no-options", "--homedir", str(private), "--batch", "--yes",
               "--no-symkey-cache", "--pinentry-mode", "loopback", "--passphrase-file", str(key)]
        if mode == "encrypt":
            verify_backup(source)
            with tarfile.open(plain, "w") as archive:
                for name in FILES:
                    archive.add(source / name, arcname=name, recursive=False)
            plain.chmod(0o600)
            subprocess.run([*gpg, "--output", str(encrypted), "--symmetric", "--cipher-algo", "AES256", str(plain)],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            encrypted.chmod(0o600)
            os.link(encrypted, destination)  # Fail closed on a concurrent destination creation.
        else:
            subprocess.run([*gpg, "--output", str(plain), "--decrypt", str(source)],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            plain.chmod(0o600)
            extracted = private / "verified"
            extracted.mkdir(mode=0o700)
            with tarfile.open(plain, "r:") as archive:
                entries = archive.getmembers()
                if len(entries) != len(FILES) or {item.name for item in entries} != set(FILES) or not all(item.isfile() for item in entries):
                    raise ValueError("Unexpected encrypted backup contents")
                for member in entries:
                    with archive.extractfile(member) as incoming, (extracted / member.name).open("xb") as outgoing:
                        os.chmod(outgoing.name, 0o600)
                        shutil.copyfileobj(incoming, outgoing)
            verify_backup(extracted)
            extracted.rename(destination)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("encrypt", "decrypt"))
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--key-file", required=True, type=Path)
    args = parser.parse_args()
    print("Verified backup output: " + str(crypt(args.mode, args.source, args.destination, args.key_file)))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError, tarfile.TarError) as error:
        raise SystemExit("Backup encryption stopped: " + type(error).__name__) from None
