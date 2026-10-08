"""Offline seed adapters: never import deployment configuration or contact a service."""
import ast
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'seed-showcase.py'


def adapters(**globals_):
    wanted = {'seed_courses', 'seed_learning', 'authorize_showcase_reviewers'}
    tree = ast.parse(SOURCE.read_text())
    tree.body = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in wanted]
    namespace = dict(globals_)
    exec(compile(tree, str(SOURCE), 'exec'), namespace)
    return namespace


class FakeClient:
    def __init__(self, courses=()):
        self.courses, self.calls = list(courses), []

    def education(self, command, entity='', data=None, version=None, admin=False):
        self.calls.append((command, entity, data, version, admin))
        return {'id': entity or 'course-' + str(len(self.calls)), 'lockVersion': 1, 'publishedVersion': 1}

    def call(self, method, path, *args):
        assert (method, path) == ('GET', '/admin/education')
        return {'courses': self.courses}, {}


class ShowcaseSchema14Tests(unittest.TestCase):
    def test_draft_is_not_sent_to_status_toggle_and_published_version_is_retained(self):
        operator = FakeClient()
        refs = {}
        fixture = [dict(key='draft', data={'title': '原始草稿'}, desiredStatus='草稿'),
                   dict(key='live', data={'title': '原始发布'}, desiredStatus='已上架')]
        adapters()['seed_courses'](operator, {}, fixture, refs)
        self.assertEqual([call[0] for call in operator.calls], ['saveCourse', 'saveCourse', 'publishCourse'])
        self.assertEqual(refs['draft']['publicationVersion'], 0)
        self.assertEqual(refs['live']['publicationVersion'], 1)
        self.assertEqual(operator.calls[-1][3], 1)

    def test_learning_uses_exact_publication_and_real_answers_after_all_chapters(self):
        admin = FakeClient([dict(id='course', status='已上架', publishedVersion=3,
            lessons=[{'id': 'a'}, {'id': 'b'}], examQuestionIds=['q'], questions=[{'id': 'q', 'answerId': 'right'}])])
        complete, partial = FakeClient(), FakeClient()
        adapters()['seed_learning'](admin, complete, partial)
        self.assertEqual([c[2] for c in complete.calls], [
            {'publicationVersion': 3, 'lessonId': 'a'}, {'publicationVersion': 3, 'lessonId': 'b'},
            {'publicationVersion': 3, 'answers': {'q': 'right'}}])
        self.assertEqual([c[2] for c in partial.calls], [{'publicationVersion': 3, 'lessonId': 'a'}])

    def test_joint_panel_scope_is_explicit_and_old_sessions_are_replaced(self):
        class Admin:
            def __init__(self): self.calls = []
            def call(self, method, path, data=None, headers=None):
                self.calls.append((method, path, data))
                return ({'id': path.rsplit('/', 1)[1], 'version': 1} if method == 'GET' else {'ok': True}), {}
        class Expert:
            def __init__(self, uid): self.user = {'id': uid}
        admin = Admin()
        clients = {'expert_zj': Expert('1'), 'expert_bj': Expert('2')}
        fresh = []
        def relogin(name, realm): fresh.append((name, realm)); return 'fresh-' + name
        dataset = {'submissions': [{'data': {'region': 'zhejiang'}}, {'data': {'region': 'beijing'}}]}
        adapters(Client=relogin)['authorize_showcase_reviewers'](admin, clients, dataset)
        self.assertEqual([call[2]['regionIds'] for call in admin.calls if call[0] == 'POST'],
                         [['beijing', 'zhejiang'], ['beijing', 'zhejiang']])
        self.assertEqual(fresh, [('expert_zj', 'admin'), ('expert_bj', 'admin')])
        self.assertEqual(clients['expert_zj'], 'fresh-expert_zj')


if __name__ == '__main__':
    unittest.main()
