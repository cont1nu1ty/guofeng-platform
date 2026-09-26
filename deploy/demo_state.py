"""Database-owned import receipts; local manifests are disposable diagnostics.

Stored as private settings so the existing backup/reset lifecycle includes them.
No credentials, expiring URLs, or local machine paths belong in these receipts.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path

BASE_ID = 'demoSeedState'
CATALOG_ID = 'demoCatalogState'


def literal(value):
    return "CONVERT(X'" + str(value).encode().hex() + "' USING utf8mb4)"


def fingerprint(here: Path):
    paths = [here / 'fixtures/showcase_content.json', here / 'fixtures/catalog_content.json']
    paths += sorted((here / 'fixtures/files').glob('*.pdf'))
    media = here.parent / 'apps/miniapp/src/pkg-content/static/media'
    paths += sorted(media.glob('*.mp4')) + sorted(media.glob('*.jpg'))
    digest = hashlib.sha256()
    for path in paths:
        digest.update(str(path.relative_to(here.parent)).encode())
        digest.update(b'\0')
        digest.update(hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest()


class Receipt:
    def __init__(self, query, project, digest, record_id=BASE_ID):
        self.query, self.project, self.digest, self.id = query, project, digest, record_id

    def read(self):
        raw = self.query(f"SELECT payload FROM jf_entity WHERE id={literal(self.id)} AND kind='setting';")
        if not raw:
            return None
        value = json.loads(raw)
        if value.get('project') != self.project:
            raise ValueError('Demo import receipt belongs to another project; no data was changed')
        if value.get('fingerprint') != self.digest:
            raise ValueError('Demo dataset differs from the installed receipt; no data was changed. '
                             'Use a new empty demo environment to try the new dataset')
        return value

    def create(self, phase, **fields):
        value = {'project': self.project, 'fingerprint': self.digest, 'phase': phase,
                 'startedAt': dt.datetime.now(dt.timezone.utc).isoformat(), **fields}
        # A unique ID also prevents two clones from both starting the base import.
        self.query(f"INSERT INTO jf_entity(id,kind,owner_id,region_id,status,payload) VALUES("
                   f"{literal(self.id)},'setting',NULL,'all','active',"
                   f"{literal(json.dumps(value, ensure_ascii=False))});")
        return value

    def save(self, value):
        value = {**value, 'project': self.project, 'fingerprint': self.digest}
        count = self.query(f"UPDATE jf_entity SET payload={literal(json.dumps(value, ensure_ascii=False))},"
                           f"version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE id={literal(self.id)} "
                           f"AND kind='setting'; SELECT ROW_COUNT();")
        if count != '1':
            raise ValueError('Demo import receipt disappeared; stop and inspect the deployment before retrying')


def next_phase(receipt):
    if receipt is None:
        return 'base'
    if receipt.get('phase') == 'complete':
        return 'done'
    if receipt.get('phase') == 'base-complete':
        return 'catalog'
    raise ValueError('The base demo import was interrupted or is still running; it cannot be resumed safely. '
                     'No data was changed. To deliberately rebuild it with a verified backup, '
                     'run ./deploy/dev reset-demo; otherwise retain the data for inspection')


def local_reference(path, project):
    """Legacy files can locate dependencies, never establish installation state."""
    if not path.exists():
        return {}
    value = json.loads(path.read_text())
    return value.get('refs', {}) if value.get('project') == project else {}
