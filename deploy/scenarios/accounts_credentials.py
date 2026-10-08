"""Fictional staff, manual dossier and credential/resource branches for the demo dataset.

All domain changes use authenticated APIs and Context checkpoints. No credential,
session token or expiring object URL belongs in scenario records.
"""
from __future__ import annotations

STAFF = (
    ('content_zj', '温予安（虚构）', 'content_operator', '浙江共读内容编辑组（虚构）'),
    ('review_zj', '许文澜（虚构）', 'review_manager', '浙江家风评审事务组（虚构）'),
    ('data_zj', '江闻笙（虚构）', 'data_operator', '浙江文化数据观察组（虚构）'),
)
CANDIDATES = (
    ('expert_pending', '程书白（虚构）', 'pending', '澄溪文史志愿组（虚构）'),
    ('expert_approved', '苏映川（虚构）', 'approved', '青禾家风研读组（虚构）'),
    ('expert_rejected', '顾行简（虚构）', 'rejected', '春芽阅读协作组（虚构）'),
)
ISSUER = '家风中华行演示签发组（虚构）'


def _create_account(ctx, username, name, role, organization):
    result = ctx.post(ctx.admin, 'accounts:create:' + username, '/admin/accounts', {
        'username': username, 'name': name, 'organization': organization,
        'roles': [role], 'regionIds': ['zhejiang'],
        'password': ctx.env['JIAFENG_DEV_PASSWORD'],
    })
    return str(result['id'])


def _dossier(ctx, username, user_id, subject, result, organization):
    path = '/admin/accounts/' + user_id
    current = ctx.get(ctx.admin, path)
    ctx.post(ctx.admin, f'accounts:materials:{username}:{subject}', path + '/materials', {
        'version': current['version'], 'subject': subject,
        'materialReference': f'虚构展示材料：{organization} / {username} / {subject}，仅用于演示人工审核流程',
        'summary': '演示编辑组登记虚构履历及说明；没有调用外部实名、学历或专业资格核验服务。',
    })
    if result != 'pending':
        current = ctx.get(ctx.admin, path)
        summary = ('展示场景：所登记的虚构资料足以进入平台人工通过分支，不代表外部实名或专业资格认证。'
                   if result == 'approved' else
                   '展示场景：虚构履历缺少可核对的评审经历说明，本轮不予通过；保留资料与结论以便再次补充。')
        ctx.post(ctx.admin, f'accounts:review:{username}:{subject}', path + '/review', {
            'version': current['version'], 'subject': subject, 'result': result, 'summary': summary,
        })


def _accounts(ctx):
    for username, name, role, organization in STAFF:
        user_id = _create_account(ctx, username, name, role, organization)
        _dossier(ctx, username, user_id, 'account', 'approved', organization)
        # Login confirms the same local password works, without persisting its response.
        ctx.client(username, admin=True)
        ctx.record('accounts:role:' + role, id=user_id, username=username, name=name,
                   role=role, regionIds=['zhejiang'], enabled=True, fictional=True,
                   scenario='可登录岗位账号；模块操作权限与地区范围分别控制')
    for username, name, status, organization in CANDIDATES:
        user_id = _create_account(ctx, username, name, 'member', organization)
        _dossier(ctx, username, user_id, 'account', 'approved', organization)
        _dossier(ctx, username, user_id, 'expert', status, organization)
        role = 'member'
        if status == 'approved':
            current = ctx.get(ctx.admin, '/admin/accounts/' + user_id)
            ctx.post(ctx.admin, 'accounts:grant-expert:' + username, '/admin/accounts/' + user_id + '/roles', {
                'version': current['version'], 'roles': ['expert'], 'regionIds': ['zhejiang'],
            })
            role = 'expert'
        # Approved expert starts paused / ungrouped in the actual account service.
        ctx.client(username, admin=role == 'expert')
        ctx.record('accounts:qualification:' + status, id=user_id, username=username, name=name,
                   role=role, regionIds=['zhejiang'], expertReviewStatus=status,
                   enabled=True, fictional=True, scenario='人工专家资料审核，不代表外部资质认证')


def _certificates(ctx):
    work_id = ctx.ref('submissions', 'shared_ladder')
    author = ctx.client('member_bj')
    agreement = ctx.get(author, '/rights/agreement')
    progress = ctx.get(author, f'/submissions/{work_id}/progress')
    work = progress['work']
    current_revision = next(r for r in progress['revisions'] if r['revisionNumber'] == work['revisionNumber'])
    confirmation = ctx.post(author, 'accounts:rights:shared_ladder', f'/submissions/{work_id}/copyright-confirmations', {
        'version': work['version'], 'revisionId': current_revision['id'],
        'agreementVersion': agreement['version'], 'accepted': True,
    })
    ctx.record('accounts:rights:shared_ladder', id=confirmation['id'], submissionId=work_id,
               username='member_bj', fictional=True, scenario='本人普通须知确认，可查全文；不是正式签章')
    award = ctx.post(ctx.admin, 'accounts:certificate:award', '/admin/certificates', {
        'kind': 'award', 'sourceId': work_id, 'issuer': ISSUER,
    })
    ctx.record('accounts:certificate:award', id=award['id'], certificateNo=award['certificateNo'],
               sourceId=work_id, sourceTitle='楼道里那把蓝梯子', username='member_bj',
               status='issued', fictional=True, scenario='有效获奖证书与匿名验真')

    learner = ctx.client('member_zj')
    course_id = ctx.ref('courses', 'course_clear_boundaries')
    history = ctx.get(learner, '/education/me')['history']
    completed = [r for r in history if r['courseId'] == course_id and r.get('completedAt')]
    if not completed:
        raise ValueError('Base showcase must retain member_zj completed learning for course_clear_boundaries')
    publication = min(int(r['publicationVersion']) for r in completed)
    source = {'kind': 'completion', 'sourceId': course_id,
              'ownerId': str(learner.user['id']), 'courseVersion': publication}
    old = ctx.post(ctx.admin, 'accounts:certificate:completion-original', '/admin/certificates', {
        **source, 'issuer': '青禾家庭课堂（虚构旧版签发名）',
    })
    # Obtain this owned issuance even after a restart, without relying on the first page order.
    page = 1
    while True:
        listing = ctx.get(learner, f'/me/certificates?page={page}&pageSize=100')
        certificate = next((row for row in listing['items'] if row['id'] == old['id']), None)
        if certificate:
            break
        if page * 100 >= listing['total']:
            raise ValueError('Original completion issuance is missing; preserve data and inspect the receipt')
        page += 1
    ctx.post(ctx.admin, 'accounts:certificate:completion-revoke', f'/admin/certificates/{old["id"]}/revoke', {
        'version': certificate['version'],
        'reason': '演示场景：原签发单位名称需要补全，撤销后保留记录，并依据同一学习资格重新签发。',
    })
    replacement = ctx.post(ctx.admin, 'accounts:certificate:completion-replacement', '/admin/certificates', {
        **source, 'issuer': ISSUER,
    })
    common = dict(sourceId=course_id, courseVersion=publication, username='member_zj', fictional=True,
                  sourceTitle='把清廉写进日常：家庭约定三讲')
    ctx.record('accounts:certificate:completion-revoked', id=old['id'], certificateNo=old['certificateNo'],
               status='revoked', scenario='撤销记录保留，停止签发新下载链接，公开验真显示撤销', **common)
    ctx.record('accounts:certificate:completion-replacement', id=replacement['id'],
               certificateNo=replacement['certificateNo'], status='issued', replaces=old['id'],
               scenario='同一历史课程发布版本的补发有效证书', **common)


def _resource_payload(file_id, title, description, license_text, region='all', audience='all_members'):
    return {'title': title, 'description': description, 'regionId': region, 'fileId': file_id,
            'licenseText': license_text, 'attribution': '家风中华行演示编辑组（原创虚构资料）',
            'audience': audience, 'status': 'draft', 'authorized': False}


def _resources(ctx):
    uploaded = ctx.upload(ctx.admin, 'accounts:resource:guide-file',
                          ctx.here / 'fixtures/files/资料使用指南.pdf', purpose='manuscript')
    file_id = uploaded['fileId']
    licence_v1 = '许可第1版：仅供本人及家庭非商业共读使用；须保留原创虚构资料说明与来源署名，不得用于宣传真实业绩。'
    licence_v2 = '许可第2版：允许家庭或社区共读小组非商业阅读与打印；须保留原创虚构资料说明及来源署名，不得冒充真实运营材料或改写后对外销售。'
    regional_licence = '浙江示例地区许可：仅供账号授权范围包含浙江的登录用户开展非商业共读；保留来源署名和虚构场景说明，跨地区分享需另行确认。'
    definitions = (
        ('guide', '家风资料使用指南 · 共读版（虚构）',
         '原创虚构资料，用于了解作品、课程及资料的使用边界；当前许可已更新至第2版。', licence_v1, 'all', 'all_members'),
        ('regional', '家风资料使用指南 · 浙江共读版（虚构）',
         '同一原创资料的地区授权展示：浙江账号可见并下载，北京等未获授权账号不能下载。', regional_licence, 'zhejiang', 'authorized_regions'),
        ('draft', '家风资料使用指南 · 编辑校对稿（虚构）',
         '编辑组正在核对来源署名与表述，保持草稿状态，不进入用户授权资源目录。', licence_v1, 'all', 'all_members'),
        ('withdrawn', '家风资料使用指南 · 已下架旧版（虚构）',
         '展示先发布再下架的记录；旧版已停止分发，用户目录不再展示，旧入口不能取得新下载链接。', licence_v1, 'all', 'all_members'),
    )
    for key, title, description, license_text, region, audience in definitions:
        payload = _resource_payload(file_id, title, description, license_text, region, audience)
        saved = ctx.post(ctx.admin, 'accounts:resource:create:' + key, '/admin/resources', payload)
        resource_id = saved['id']
        version = 1
        status = 'draft'
        if key != 'draft':
            published = {**payload, 'version': version, 'status': 'published', 'authorized': True}
            ctx.post(ctx.admin, 'accounts:resource:publish:' + key, '/admin/resources/' + resource_id, published)
            version += 1
            status = 'published'
            if key == 'guide':
                ctx.post(ctx.admin, 'accounts:resource:licence-v2', '/admin/resources/' + resource_id,
                         {**published, 'version': version, 'licenseText': licence_v2})
                version += 1
            if key == 'withdrawn':
                ctx.post(ctx.admin, 'accounts:resource:withdraw', '/admin/resources/' + resource_id,
                         {**published, 'version': version, 'status': 'withdrawn', 'authorized': False})
                version += 1
                status = 'withdrawn'
        ctx.record('accounts:resource:' + key, id=resource_id, title=title, fileId=file_id,
                   status=status, version=version, regionId=region, audience=audience,
                   licenceVersion=2 if key == 'guide' else 1, fictional=True,
                   scenario={'guide': '发布后更新许可；旧资源版本不能直接授权下载',
                             'regional': '按账号地区限制可见性及下载', 'draft': '仅运营人员可见的草稿',
                             'withdrawn': '曾发布后下架；运营保留记录，用户入口失效'}[key])


def seed(ctx):
    _accounts(ctx)
    _certificates(ctx)
    _resources(ctx)
