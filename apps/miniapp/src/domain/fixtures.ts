import type {
  Activity,
  ChannelId,
  Classic,
  GenreId,
  Option,
  RegionId,
  ReviewStage,
  Work,
} from './types'

export const genres: Option<GenreId>[] = [
  { id: 'letter', label: '家风家书' },
  { id: 'essay', label: '家风纪实散文' },
  { id: 'poetry', label: '家风诗词楹联' },
  { id: 'memoir', label: '红色家风回忆录' },
  { id: 'biography', label: '乡贤家族传记' },
  { id: 'family-rules', label: '家训手记' },
  { id: 'family-notes', label: '最美家庭手记' },
  { id: 'commentary', label: '家风文论' },
]
export const channels: Option<ChannelId>[] = [
  { id: 'public-service', label: '党政干部' },
  { id: 'school', label: '校园青少年' },
  { id: 'community', label: '城乡群众' },
  { id: 'special', label: '特色群体' },
]
export const regions: Option<RegionId>[] = [
  { id: 'all', label: '全国' },
  { id: 'beijing', label: '北京' },
  { id: 'zhejiang', label: '浙江' },
  { id: 'sichuan', label: '四川' },
]
/** 原文的六级路径仍在讨论，以下仅用于沟通界面，不代表正式评审制度。 */
export const reviewStages: ReviewStage[] = [
  {
    id: 'initial',
    label: '区县初审',
    description: '核对基本资料与投稿内容，具体标准待定。',
    tentative: true,
  },
  {
    id: 'municipal',
    label: '市级行业复审',
    description: '示例复审节点，层级与职责待定。',
    tentative: true,
  },
  {
    id: 'expert',
    label: '文史专家评审',
    description: '示例专家评议节点，专家机制待定。',
    tentative: true,
  },
  {
    id: 'specialist',
    label: '专项终审',
    description: '示例专项评议节点，适用范围待定。',
    tentative: true,
  },
  {
    id: 'national',
    label: '国家级复核',
    description: '示例复核节点，组织主体待确认。',
    tentative: true,
  },
  {
    id: 'final',
    label: '全国标准审定',
    description: '示例审定节点，不构成入选或授奖承诺。',
    tentative: true,
  },
]

export const seedWorks: Work[] = [
  {
    id: 'DEMO-WORK-001',
    title: '把日子过成一封家书',
    author: '林禾（虚构作者）',
    genre: 'letter',
    channel: 'community',
    region: 'zhejiang',
    excerpt: '饭桌上的一盏灯，旧书里的一片叶，把平凡的日子写给远方的你。',
    content:
      '【演示原创内容；人物与情节均为虚构】\n\n亲爱的孩子：\n\n昨天整理书柜，我又找到了你小时候夹在书里的那片银杏叶。叶子已经干了，书页上却还留着我们一起散步的时光。\n\n家里没有什么昂贵的传家宝。外婆教我们做事守信，父亲教我们待人诚恳。我希望留给你的，也正是这些能在平常日子里做到的小事：答应别人的事认真完成，遇见困难的人多问一句，吃饭时记得等一等还在厨房忙碌的人。\n\n愿你走得再远，也能在心里为家人留一盏灯。',
    status: 'collected',
    statusLabel: '典藏示例',
    submittedAt: '2026-09-01T08:00:00.000Z',
    progressIndex: 5,
    tags: ['孝老爱亲', '家书'],
    isMine: false,
    isDemo: true,
  },
  {
    id: 'DEMO-WORK-002',
    title: '一张餐桌的四季',
    author: '许安（虚构作者）',
    genre: 'essay',
    channel: 'school',
    region: 'beijing',
    excerpt: '从一餐一饭开始，听见三代人关于珍惜与分享的回答。',
    content:
      '【演示原创内容；人物与情节均为虚构】\n\n我们家的餐桌很旧，桌角有一道浅浅的划痕。爷爷说，那是我学着摆碗筷时留下的。\n\n春天，我们把新鲜的青菜端给邻居尝尝；夏天，晚归的人总能找到一碗温热的粥；秋天，奶奶会把多余的果子分装好；冬天，热汤的香气让所有人都慢下来。\n\n原来，家风并不是贴在墙上的大字，而是知道每一粒米来之不易，是给别人留一把椅子，是把好好吃饭变成认真相待。',
    status: 'collected',
    statusLabel: '典藏示例',
    submittedAt: '2026-09-03T08:00:00.000Z',
    progressIndex: 5,
    tags: ['勤俭', '少年笔记'],
    isMine: false,
    isDemo: true,
  },
  {
    id: 'DEMO-WORK-003',
    title: '竹影里的约定',
    author: '周宁（虚构作者）',
    genre: 'family-rules',
    channel: 'community',
    region: 'sichuan',
    excerpt: '一件借来的小工具，记着祖孙之间关于守信的约定。',
    content:
      '【演示原创内容；人物与情节均为虚构】\n\n小时候，我跟着祖父修理院子里的竹篱笆。隔壁借给我们一把小锯子，祖父用完以后，总要擦净，再亲手还回去。\n\n我问他，明天再还不行吗？他笑着说，物件虽小，约定却不能轻。\n\n后来我长大了，也常常记起竹影下的那句话。家训可以很短，实践却要很长。从认真归还一件东西开始，让信任在一次次小事中生根。',
    status: 'in_review',
    statusLabel: '评审中（演示）',
    submittedAt: '2026-09-06T08:00:00.000Z',
    progressIndex: 2,
    tags: ['诚信', '家训'],
    isMine: false,
    isDemo: true,
  },
  {
    id: 'DEMO-WORK-004',
    title: '清风自家门起',
    author: '陈砚（虚构作者）',
    genre: 'commentary',
    channel: 'public-service',
    region: 'beijing',
    excerpt: '把诚实与自律带回日常，在家人的相互提醒中守住一份清明。',
    content:
      '【演示原创内容；人物与情节均为虚构】\n\n家风的意义，在于让朴素的道理变成可践行的生活方式。诚实、自律、尊重他人，并不只属于课堂或书本。\n\n面对一件小事，我们是否愿意遵守约定；做出一个决定，我们是否能坦然向家人说明；拥有一种便利，我们是否仍尊重共同的规则。这些日常选择，构成了家庭教育最生动的部分。\n\n清风可以从家门起，在相互理解与提醒中，传向更广阔的生活。',
    status: 'pending_initial_review',
    statusLabel: '待初审（演示）',
    submittedAt: '2026-09-10T08:00:00.000Z',
    progressIndex: 0,
    tags: ['清廉家风', '思考'],
    isMine: false,
    isDemo: true,
  },
]

export const seedClassics: Classic[] = [
  {
    id: 'DEMO-CLASSIC-001',
    title: '家书里的中国',
    subtitle: '示例总卷 · 书信与日常',
    author: '演示编辑组（虚构）',
    region: 'all',
    category: '家书选读',
    coverColor: '#7c2629',
    chapterCount: 3,
    excerpt: '在一笔一画里，读懂家人之间最朴素的牵挂。',
    content:
      '【演示原创选读，非已出版典籍】\n\n第一章 · 见字如面\n\n写一封家书，不必寻找华丽的辞藻。先问问家人的近况，再讲讲今天遇见的小事。把一份牵挂认真写下来，便是人与人之间温柔的联系。\n\n第二章 · 日常有光\n\n家书里可以有一碗热汤，有院子里新开的花，也有一个需要商量的困难。真实的生活，使每一份表达都有自己的分量。\n\n第三章 · 留给明天\n\n将信妥善保存，也将尊重、理解与关爱留在日常行动里。让家书成为家庭共同成长的记录。',
    isDemo: true,
  },
  {
    id: 'DEMO-CLASSIC-002',
    title: '江南家训札记',
    subtitle: '示例地方卷 · 浙江',
    author: '演示编辑组（虚构）',
    region: 'zhejiang',
    category: '家训手记',
    coverColor: '#49625b',
    chapterCount: 2,
    excerpt: '从勤读、守信与惜物开始，记录可以实践的家庭约定。',
    content:
      '【演示原创选读，非已出版典籍】\n\n勤读\n\n读书不求一时记住多少，而求每天能多懂一点。家人一起读一页书，交换一个问题，便给日常生活打开一扇窗。\n\n守信\n\n承诺之前认真想一想，承诺之后踏实做一做。无法做到时及时说明，也是一种诚实。让规则在相互尊重中成为习惯。',
    isDemo: true,
  },
  {
    id: 'DEMO-CLASSIC-003',
    title: '竹院里的家风',
    subtitle: '示例地方卷 · 四川',
    author: '演示编辑组（虚构）',
    region: 'sichuan',
    category: '百姓家风',
    coverColor: '#927044',
    chapterCount: 2,
    excerpt: '一院竹影，几代人的相互照看，组成平实而绵长的故事。',
    content:
      '【演示原创选读，非已出版典籍】\n\n照看\n\n邻里间的一次问候，家人间的一次倾听，都是生活里可贵的照看。愿意停下来听别人说完，是尊重的开始。\n\n传承\n\n我们不必把每一条经验都变成要求。将自己的选择讲清楚，也听听年轻人的想法，让传承发生在平等的交流中。',
    isDemo: true,
  },
]

export const seedActivities: Activity[] = [
  {
    id: 'DEMO-ACTIVITY-001',
    title: '把家书读给你听',
    category: '亲子共读',
    region: 'beijing',
    location: '北京 · 示例阅读空间',
    organizer: '家风演示工作坊（虚构）',
    date: '2026-10-18',
    time: '14:00–16:00',
    capacity: 40,
    registeredCount: 24,
    excerpt: '用一封家书，开启一次亲子之间的认真倾听。',
    content:
      '【演示活动，不是真实招募，报名仅保存在当前设备】\n\n一起选读演示家书，交流各自理解，再写一段想对家人说的话。\n\n流程：共读热身、家庭对话、家书创作、分享与回顾。示例时长两小时，不收取费用。',
    isDemo: true,
  },
  {
    id: 'DEMO-ACTIVITY-002',
    title: '一座书院的家风课',
    category: '文化研学',
    region: 'zhejiang',
    location: '浙江 · 示例文化空间',
    organizer: '家风演示工作坊（虚构）',
    date: '2026-10-24',
    time: '09:30–11:30',
    capacity: 30,
    registeredCount: 18,
    excerpt: '在读书、问答与书写中，寻找家训与今天生活的联系。',
    content:
      '【演示活动，不是真实招募，报名仅保存在当前设备】\n\n以阅读和交流为主要形式，了解家庭约定的意义。\n\n流程：示例展陈讲解、家训主题问答、家庭约定卡制作。场地与安排均为沟通用样例。',
    isDemo: true,
  },
  {
    id: 'DEMO-ACTIVITY-003',
    title: '竹简上的一句家训',
    category: '手作体验',
    region: 'sichuan',
    location: '四川 · 示例社区工坊',
    organizer: '家风演示工作坊（虚构）',
    date: '2026-11-01',
    time: '10:00–11:30',
    capacity: 24,
    registeredCount: 12,
    excerpt: '把家庭共同认可的一句话写下来，带回日常生活。',
    content:
      '【演示活动，不是真实招募，报名仅保存在当前设备】\n\n选择一句属于自己家庭的约定，在纸质竹简卡上完成书写。\n\n流程：家训故事交流、文字草拟、手作书写、共同分享。本演示不产生真实预约。',
    isDemo: true,
  },
]
export const seeds = { works: seedWorks, classics: seedClassics, activities: seedActivities }
