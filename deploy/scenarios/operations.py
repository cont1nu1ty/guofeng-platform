"""Real export jobs and opt-in delivery examples; never forge scheduled history."""
from __future__ import annotations
import datetime as dt


def seed(ctx):
    admin = ctx.admin
    volume = ctx.ref('collections', 'collection_everyday')
    for fmt in ('pdf', 'docx'):
        result = ctx.post(admin, 'operations:export:' + fmt, '/admin/exports', {
            'kind': 'collection', 'ids': [volume], 'format': fmt, 'region': 'all'})
        ctx.record('operations:export:' + fmt, id=result['id'], username='devadmin',
                   scenario='已入藏典籍的固定内容快照，' + fmt.upper() + '真实文件生成')
    result = ctx.post(admin, 'operations:export:csv', '/admin/exports', {
        'kind': 'csv', 'collection': 'submissions', 'region': 'zhejiang'})
    ctx.record('operations:export:csv', id=result['id'], username='devadmin',
               scenario='仅浙江作品，服务端筛选与CSV导出')

    # Deliberately unsupported glyph is an explicit editorial demonstration,
    # not a forged job status. The executor itself records retries and failure.
    bad = ctx.cmd(admin, 'operations:volume:proof', 'saveCollection', data={
        'title': '排版待校样：特殊字形演示', 'subtitle': '未发布的排版故障示例',
        'theme': '传承', 'region': 'zhejiang'})
    row = ctx.entity('collections', bad['id'])
    ctx.cmd(admin, 'operations:volume:glyph', 'saveChapter', bad['id'], {
        'title': '待替换的装饰符号', 'author': '演示编辑组（虚构）',
        'body': '本章故意保留当前PDF字体不支持的符号 🤯，用于展示排版失败、重试和取消；不是正式出版内容。'},
        version=row['lockVersion'])
    result = ctx.post(admin, 'operations:export:failure', '/admin/exports', {
        'kind': 'collection', 'ids': [bad['id']], 'format': 'pdf', 'region': 'zhejiang'})
    ctx.record('operations:export:failure', id=result['id'], sourceId=bad['id'], username='devadmin',
               expectedError='FONT_GLYPH_MISSING', scenario='实际排版失败；自动重试3次后保留失败，可手动重试或取消')
    cancelled = ctx.post(admin, 'operations:export:cancelled', '/admin/exports', {
        'kind': 'collection', 'ids': [bad['id']], 'format': 'pdf', 'region': 'zhejiang'})
    ctx.post(admin, 'operations:cancel', '/admin/exports/' + cancelled['id'] + '/cancel', {})
    ctx.record('operations:export:cancelled', id=cancelled['id'], username='devadmin',
               scenario='通过真实取消接口停止的导出任务')

    # Statistics derive from this installation, with no fictional historical totals.
    data = ctx.client('data_zj', True)
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    result = ctx.post(data, 'operations:report:current', '/admin/exports', {
        'kind': 'report', 'region': 'zhejiang', 'from': today.replace(day=1).isoformat(),
        'to': (today + dt.timedelta(days=1)).isoformat()})
    ctx.record('operations:report:current', id=result['id'], username='data_zj',
               scenario='浙江数据岗可下载本月截至导入日的真实示例业务统计快照；不是自动归档历史')
    for username, staff, digest, draft_notice, reports in (
        ('member_zj', False, 'daily', True, []),
        ('member_bj', False, 'weekly', False, []),
        ('member_js', False, 'off', False, []),
        ('data_zj', True, 'off', True, ['month', 'quarter', 'year']),
    ):
        result = ctx.request(ctx.client(username, staff), 'operations:preference:' + username,
                             'PUT', '/me/delivery-preferences',
                             {'digest': digest, 'draftNotice': draft_notice, 'reports': reports})
        ctx.record('operations:preference:' + username, username=username, **result,
                   scenario='从实际启用时间开始等待周期；不倒填启用时间、不伪造已发送摘要或历史报告')
    # Server deduplicates by account/content/action/day, so repeat imports cannot
    # inflate these intentional example interactions.
    content = ctx.ref('contents', 'news_shared_tools')
    for username in ('member_zj', 'member_bj', 'member_js'):
        for action in ('view', 'share_intent'):
            ctx.post(ctx.client(username), f'operations:engagement:{username}:{action}',
                     '/engagement/events', {'kind': 'content', 'targetId': content, 'action': action})
    ctx.record('operations:engagement', sourceId=content, username='data_zj',
               scenario='3个演示账号的浏览与分享意图事件；分享意图不等于实际分享成功或传播人数')
