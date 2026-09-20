/** Original prototype content. These entries are not official publications or actual events. */
export type BilingualText = { zh: string; en: string }
const b = (zh: string, en: string): BilingualText => ({ zh, en })

export const newsCategories = [
  { id: 'all', label: b('全部动态', 'All updates') },
  { id: 'notice', label: b('平台公告', 'Notices') },
  { id: 'policy', label: b('政策学习', 'Policy learning') },
  { id: 'activity', label: b('活动报道', 'Activities') },
  { id: 'role-model', label: b('家庭榜样', 'Family stories') },
] as const
export const familyTopics = [
  {
    id: 'red',
    label: b('红色家风', 'Red heritage'),
    mark: '志',
    description: b(
      '把理想与责任，写进代代相传的家书。',
      'Carry ideals and responsibility through family letters.',
    ),
  },
  {
    id: 'integrity',
    label: b('清廉干部家风', 'Integrity at home'),
    mark: '廉',
    description: b(
      '从一餐一饭、一言一行中涵养清廉家风。',
      'Nurture integrity in everyday choices.',
    ),
  },
  {
    id: 'everyday',
    label: b('百姓家风', 'Everyday family values'),
    mark: '和',
    description: b(
      '记录平凡家庭的相互照看与温暖约定。',
      'Discover the care and promises in ordinary families.',
    ),
  },
  {
    id: 'classical',
    label: b('先贤文脉', 'Classical wisdom'),
    mark: '文',
    description: b(
      '读古人家训，寻找与当代生活的对话。',
      'Connect classical family wisdom with life today.',
    ),
  },
] as const
export type FamilyTopic = (typeof familyTopics)[number]['id']
export interface NewsArticle {
  id: string
  category: Exclude<(typeof newsCategories)[number]['id'], 'all'>
  topic: FamilyTopic
  title: BilingualText
  excerpt: BilingualText
  date: string
  paragraphs: BilingualText[]
  relatedScreen?: 'submit' | 'classroom' | 'learning' | 'library'
  relatedLabel?: BilingualText
}
export const newsArticles: NewsArticle[] = [
  {
    id: 'notice-autumn',
    category: 'notice',
    topic: 'everyday',
    date: '2026-09-20',
    title: b(
      '“一封家书，一份传承”秋日征集说明',
      'Autumn family letter collection: a prototype notice',
    ),
    excerpt: b(
      '从家中小事写起，用文字记录值得传承的生活态度。',
      'Start with a small moment at home and share a value worth passing on.',
    ),
    paragraphs: [
      b(
        '本篇是用于产品沟通的原创公告样例，不是正式征集通知。当前开放文字投稿的本机演示体验，您可以用虚构人物与故事完成操作。',
        'This is an original prototype notice, not an official call for submissions. Try the local submission flow with fictional names and stories.',
      ),
      b(
        '主题可围绕孝老爱亲、诚实守信、勤俭持家、邻里互助与爱国奉献展开。表达以真实感受和具体故事为主，不必追求华丽词句。',
        'Sample themes include care for elders, honesty, thrift, helping neighbours and public responsibility. Focus on concrete stories rather than elaborate wording.',
      ),
      b(
        '演示路径：选择投稿通道和体裁，完善正文与附件说明，预览内容并阅读示例协议，提交后在个人中心查询进度。',
        'Demo steps: choose a submission channel and genre, draft the text, preview the content, read the sample agreement and follow progress in your profile.',
      ),
    ],
    relatedScreen: 'submit',
    relatedLabel: b('体验家风投稿', 'Try a submission'),
  },
  {
    id: 'red-letter',
    category: 'activity',
    topic: 'red',
    date: '2026-09-18',
    title: b(
      '家书共读：把责任写给下一代',
      'Reading together: sharing responsibility with the next generation',
    ),
    excerpt: b(
      '一场示例共读活动，从家庭约定谈到公共责任。',
      'A sample reading session connects family promises with public responsibility.',
    ),
    paragraphs: [
      b(
        '在这场虚构的家书共读中，三组家庭围坐交流。每位参与者选取一段原创示例家书，讲述自己理解的责任与担当。',
        'In this fictional reading session, three families share original sample letters and discuss what responsibility means to them.',
      ),
      b(
        '孩子们把“按时完成承诺”“爱护公共物品”“主动帮助他人”写在约定卡上。长辈也写下自己的行动，约定与孩子一起实践。',
        'Children record promises such as keeping commitments, caring for shared spaces and helping others. Adults write their own actions beside them.',
      ),
      b(
        '红色家风的学习可以从身边开始，把珍惜、守信、奉献落实在日常。本报道为产品原创样例，所述人物和活动均为虚构。',
        'Learning about red heritage can begin with everyday commitments to care, honesty and service. All people and events in this original prototype article are fictional.',
      ),
    ],
    relatedScreen: 'classroom',
    relatedLabel: b('走进主题课堂', 'Explore the classroom'),
  },
  {
    id: 'integrity-learning',
    category: 'policy',
    topic: 'integrity',
    date: '2026-09-17',
    title: b(
      '学习专栏：让清廉成为家庭的共同约定',
      'Learning column: integrity as a shared family commitment',
    ),
    excerpt: b(
      '政策学习栏目的排版样例：导读、学习要点与讨论问题。',
      'A sample policy-learning layout with an introduction, key ideas and questions.',
    ),
    paragraphs: [
      b(
        '本栏目当前展示原创学习导读，用于讨论政策内容的呈现方式。尚未接入正式政策文件，不构成政策解释；上线时应补齐权威来源、文号、发布日期与原文链接。',
        'This original learning introduction demonstrates a policy-content layout. No official policy document is connected, and this is not a policy interpretation. Production content needs an authoritative source, document number, publication date and original link.',
      ),
      b(
        '讨论要点一：公共事务与私人关系如何保持清晰边界？讨论要点二：家人如何以尊重和理解的方式相互提醒？',
        'Discussion point one: how can public duties and personal relationships remain clearly separated? Point two: how can family members remind one another with respect and understanding?',
      ),
      b(
        '课后可以共同写下三条可执行的家庭约定，例如诚实表达、不攀比、珍惜劳动成果。用具体行动代替空泛口号。',
        'After learning, write three practical family commitments, such as being honest, avoiding comparison and respecting others’ work. Choose specific actions.',
      ),
    ],
    relatedScreen: 'classroom',
    relatedLabel: b('学习清廉家风课', 'Open integrity courses'),
  },
  {
    id: 'everyday-family',
    category: 'role-model',
    topic: 'everyday',
    date: '2026-09-16',
    title: b('一张餐桌，三代人的温暖约定', 'One table, three generations of care'),
    excerpt: b(
      '林家的“一起吃饭日”，记录相互倾听的日常。',
      'A fictional family’s shared meal becomes a time to listen.',
    ),
    paragraphs: [
      b(
        '林家每周安排一次“一起吃饭日”。大家轮流准备饭菜，也轮流讲一件这一周最想分享的事。这个家庭与故事均为产品演示而虚构。',
        'The fictional Lin family sets aside one shared meal each week. They take turns cooking and telling a story from the week.',
      ),
      b(
        '遇到意见不同的时候，他们约定先听对方说完。餐桌上没有评比，也没有谁必须给出标准答案。小小的约定，让每个人都感到被尊重。',
        'When opinions differ, they agree to let each person finish speaking. There is no competition or required answer at the table, only the chance to be heard.',
      ),
      b(
        '好的家风并不遥远。为晚归的人留一碗汤，主动分担一次家务，认真回应一句问候，都是可以从今天开始的行动。',
        'Family values can be practised today: leave soup for someone arriving late, share a household task or give a thoughtful reply to a greeting.',
      ),
    ],
    relatedScreen: 'learning',
    relatedLabel: b('参加家书共读', 'Explore reading activities'),
  },
  {
    id: 'classical-reading',
    category: 'activity',
    topic: 'classical',
    date: '2026-09-15',
    title: b('古训今读：让书页里的道理走进生活', 'Reading classical wisdom in everyday life'),
    excerpt: b(
      '一场书院阅读活动，把“勤读、守信、惜物”变成行动卡。',
      'A sample academy session turns reading, honesty and care into action cards.',
    ),
    paragraphs: [
      b(
        '示例书院的阅读桌上，摆放着三张卡片：勤读、守信、惜物。参与者先分享自己熟悉的家庭故事，再写下能够做到的一件小事。',
        'At the fictional academy, three cards introduce reading, honesty and care for belongings. Participants share family stories and choose one achievable action.',
      ),
      b(
        '有人约定每天读一页书，有人准备归还借来的物品，还有人打算与家人修好一把旧椅子。理解传统文化，可以从一次具体实践开始。',
        'One person chooses a page of reading each day, another plans to return a borrowed item and another wants to repair an old chair with family.',
      ),
      b(
        '本篇为原创活动报道样例，并非真实场馆发布。后续可配合经授权的古籍影像、讲解音频与研学资料，丰富阅读体验。',
        'This is an original sample report rather than a real venue announcement. Licensed manuscript images, narration and learning materials may enrich the experience later.',
      ),
    ],
    relatedScreen: 'library',
    relatedLabel: b('进入家风典藏', 'Open the collection'),
  },
  {
    id: 'red-family-story',
    category: 'role-model',
    topic: 'red',
    date: '2026-09-13',
    title: b('旧笔记本里，留下服务他人的心愿', 'A notebook preserves a wish to serve others'),
    excerpt: b(
      '从祖辈的一本笔记，读到一个家庭共同的责任意识。',
      'A fictional notebook connects generations through a sense of duty.',
    ),
    paragraphs: [
      b(
        '整理旧书柜时，许安发现一本记满小事的笔记：帮邻居修门、陪老人读报、整理社区图书。主人公与情节均为虚构，不对应历史人物。',
        'While tidying a bookcase, the fictional Xu An finds notes about repairing a neighbour’s door, reading with an elder and organising community books. No historical person is represented.',
      ),
      b(
        '笔记没有宏大的叙述，却记录着长辈对他人的关心。许安决定把自己的志愿服务经历也记下来，与家人分享遇见的人和学到的事。',
        'The notes describe small acts of care. Xu An starts a notebook of volunteer experiences to share with family.',
      ),
      b(
        '传承可以是一种选择：在需要的时候多做一点，在答应之后认真完成，在日常中承担属于自己的责任。',
        'Inheritance can be a choice: offer help when it is needed, keep a promise and take responsibility in everyday life.',
      ),
    ],
  },
  {
    id: 'integrity-notice',
    category: 'notice',
    topic: 'integrity',
    date: '2026-09-12',
    title: b(
      '清廉课堂体验指南：从学习到家庭约定',
      'Integrity classroom guide: from learning to action',
    ),
    excerpt: b(
      '三节示例课程、一题情景测验，体验完整学习流程。',
      'Try three sample lessons and a scenario question.',
    ),
    paragraphs: [
      b(
        '清廉课堂新增独立课程页。选择课程后可以阅读课节材料，点击“完成本节演示”记录进度，再完成情景问答。',
        'The classroom now has dedicated course pages. Read each sample lesson, mark it as completed and answer a scenario question.',
      ),
      b(
        '进度仅保存在当前设备，结业样张只用于展示，不计入真实学时，也不代表任何培训机构认证。',
        'Progress is stored only on this device. Completion samples do not count toward training hours or institutional certification.',
      ),
      b(
        '建议体验顺序：阅读导学，逐节学习，完成测验，查看学习记录与结业样张。清理本机存储后记录会被移除。',
        'Suggested flow: read the introduction, complete the lessons, answer the question and review your record and sample certificate. Clearing local storage removes these records.',
      ),
    ],
    relatedScreen: 'classroom',
    relatedLabel: b('进入清廉课堂', 'Open the classroom'),
  },
  {
    id: 'classical-topic',
    category: 'role-model',
    topic: 'classical',
    date: '2026-09-10',
    title: b('家训不只在墙上，也在彼此的行动里', 'Family principles live in our actions'),
    excerpt: b(
      '用当代家庭故事，理解传统家训中的朴素智慧。',
      'Explore traditional wisdom through an original contemporary family story.',
    ),
    paragraphs: [
      b(
        '“借物及时还，承诺认真做。”虚构的周家把这句话写在书桌旁。祖孙一起整理工具时，也会认真检查借来的物件是否完好。',
        'The fictional Zhou family writes “return borrowed things and keep promises” beside the desk. While tidying tools, they check that borrowed items are well cared for.',
      ),
      b(
        '家训并非只有一种写法。一个家庭共同讨论、愿意实践的约定，也可以成为属于自己的家训。',
        'There is no single way to write family principles. A promise discussed and practised together can become a family’s own tradition.',
      ),
      b(
        '本篇为产品原创内容样例。典籍引文和人物史料在正式上线前应经过来源核验与编辑审核。',
        'This is original prototype content. Classical quotations and historical materials will require source verification and editorial review before publication.',
      ),
    ],
    relatedScreen: 'library',
    relatedLabel: b('阅读典藏样章', 'Read sample chapters'),
  },
]

export interface CourseLesson {
  id: string
  title: BilingualText
  duration: number
  body: BilingualText
  practice: BilingualText
}
export interface Course {
  id: string
  title: BilingualText
  theme: BilingualText
  description: BilingualText
  mark: string
  audience: BilingualText
  lessons: CourseLesson[]
  quiz: {
    question: BilingualText
    options: BilingualText[]
    answer: number
    explanation: BilingualText
  }
}
export const courses: Course[] = [
  {
    id: 'integrity-home',
    title: b('清风入家 · 清廉从日常开始', 'Integrity begins at home'),
    theme: b('清廉教育', 'Integrity'),
    mark: '廉',
    audience: b('家庭共学 / 干部家属', 'Families and public-service households'),
    description: b(
      '从家庭边界、共同约定到相互提醒，让清廉理念成为日常选择。',
      'Explore boundaries, shared commitments and respectful reminders in family life.',
    ),
    lessons: [
      {
        id: 'boundaries',
        title: b('第一课：公与私的边界', 'Lesson 1: public and private boundaries'),
        duration: 8,
        body: b(
          '想象这样一个情景：熟人希望借家庭聚会请你帮忙处理一件需要依规办理的事。家人的理解与支持，有助于保持公私边界。把事情交回明确、公开的正常流程，是可以讨论的一种选择。',
          'Imagine an acquaintance seeking special help at a family gathering for a matter with an established process. A family’s understanding can support clear boundaries. Referring the matter to the normal transparent process is one possible response.',
        ),
        practice: b(
          '思考：怎样用礼貌、明确的话说明这条边界？',
          'Reflect: how would you explain the boundary politely and clearly?',
        ),
      },
      {
        id: 'agreements',
        title: b('第二课：写下家庭约定', 'Lesson 2: write a family commitment'),
        duration: 6,
        body: b(
          '家庭约定应当具体、易懂、能执行。与家人商量：不因攀比而超出自己的生活安排，诚实说明事情的缘由，珍惜每个人的劳动。每个人都可以提出意见，也共同承担践行的责任。',
          'A family commitment works best when it is clear and achievable. Discuss avoiding comparison, explaining decisions honestly and respecting everyone’s work. Each person can contribute and share responsibility.',
        ),
        practice: b(
          '练习：写一条愿意与家人共同做到的日常约定。',
          'Practice: write one everyday promise you would like to keep together.',
        ),
      },
      {
        id: 'reminders',
        title: b('第三课：把提醒变成关爱', 'Lesson 3: reminders as care'),
        duration: 7,
        body: b(
          '提醒不必等到问题发生。日常沟通时，先倾听对方的难处，再表达自己的担心和建议。约定一个适合家庭的交流时间，用平等、尊重的方式讨论遇到的情景。',
          'A reminder can come before a problem. Listen first, then explain concerns and suggestions. Find a time to discuss everyday situations with equality and respect.',
        ),
        practice: b(
          '练习：用“我关心的是……”开始一次家庭对话。',
          'Practice: begin a family conversation with “What I care about is…”',
        ),
      },
    ],
    quiz: {
      question: b(
        '亲友提出绕过正常程序的请求时，哪种回应更合适？',
        'How should a request to bypass the normal process be handled?',
      ),
      options: [
        b('碍于情面，先答应再说', 'Agree first to avoid embarrassment'),
        b(
          '说明边界，建议依正常公开流程办理',
          'Explain the boundary and suggest the normal transparent process',
        ),
        b('不与家人沟通，独自处理', 'Handle it alone without discussing concerns'),
      ],
      answer: 1,
      explanation: b(
        '示例解析：说明边界、尊重规则，同时保持坦诚沟通，能够让家庭支持与公共责任相协调。',
        'Sample explanation: clear boundaries, respect for rules and honest communication help align family support with public responsibility.',
      ),
    },
  },
  {
    id: 'letters-responsibility',
    title: b('家书里的责任与担当', 'Responsibility in family letters'),
    theme: b('红色家风', 'Red heritage'),
    mark: '志',
    audience: b('青少年 / 亲子家庭', 'Young learners and families'),
    description: b(
      '读一封原创示例家书，理解承诺、互助与责任的日常含义。',
      'Read an original sample letter and explore commitment, care and responsibility.',
    ),
    lessons: [
      {
        id: 'read',
        title: b('第一课：从一句叮咛读起', 'Lesson 1: begin with a reminder'),
        duration: 5,
        body: b(
          '示例家书写道：“愿你答应的事认真去做，也愿你在别人需要时伸出手。”这不是历史文献，而是一段为课堂创作的文字。读一读，找到你最想回应的一句话。',
          'Our original sample letter says: “Keep your promises carefully and offer a hand when someone needs one.” This is a classroom writing sample, not a historical document. Find a sentence you would like to respond to.',
        ),
        practice: b(
          '思考：你最近完成过哪一个承诺？',
          'Reflect: what promise have you kept recently?',
        ),
      },
      {
        id: 'act',
        title: b('第二课：让责任成为行动', 'Lesson 2: turn responsibility into action'),
        duration: 6,
        body: b(
          '责任可以是按时完成自己的任务，也可以是珍惜公共物品、主动承担家务。在力所能及的范围内，为家庭和身边的人做一件事，便是一个具体的开始。',
          'Responsibility may mean finishing a task, caring for shared belongings or helping at home. Start with one achievable action for family or neighbours.',
        ),
        practice: b(
          '练习：列出今天可以完成的一项行动。',
          'Practice: name one action you can finish today.',
        ),
      },
      {
        id: 'reply',
        title: b('第三课：写下你的回信', 'Lesson 3: write a reply'),
        duration: 8,
        body: b(
          '回信不必很长。先回应家人的关心，再讲一个自己的经历，最后写下下一步的打算。让文字具体、诚恳，保留你自己的表达方式。',
          'A reply can be short. Acknowledge your family’s care, share an experience and describe your next step. Write sincerely in your own voice.',
        ),
        practice: b('练习：用三句话完成一封简短回信。', 'Practice: write a three-sentence reply.'),
      },
    ],
    quiz: {
      question: b(
        '哪种表达更能体现对家庭约定的践行？',
        'Which response best puts a family commitment into practice?',
      ),
      options: [
        b('写下具体行动，并认真完成', 'Choose a specific action and follow through'),
        b('只用华丽的词句表达', 'Use elaborate wording without action'),
        b('只要求其他家人做到', 'Expect only other family members to act'),
      ],
      answer: 0,
      explanation: b(
        '示例解析：具体行动与认真践行，让文字中的责任成为生活中的习惯。',
        'Sample explanation: specific actions and follow-through make responsibility a daily habit.',
      ),
    },
  },
  {
    id: 'everyday-table',
    title: b('一餐一饭中的家风课', 'Family values around the table'),
    theme: b('家庭共学', 'Learning together'),
    mark: '和',
    audience: b('全年龄家庭', 'Families of all ages'),
    description: b(
      '从珍惜粮食、倾听家人、共同分工开始，把家风带回生活。',
      'Practise care, listening and shared responsibility through everyday meals.',
    ),
    lessons: [
      {
        id: 'care',
        title: b('第一课：珍惜一餐一饭', 'Lesson 1: appreciate every meal'),
        duration: 5,
        body: b(
          '一顿饭需要许多人的劳动。备餐前讨论适量的份量，用餐后共同整理。珍惜并非形式，而是看见食物、时间与劳动背后的价值。',
          'Every meal involves many people’s work. Plan suitable portions and tidy up together. Appreciation begins by noticing the value of food, time and effort.',
        ),
        practice: b(
          '练习：向今天准备饭菜的人表达感谢。',
          'Practice: thank someone who prepared a meal today.',
        ),
      },
      {
        id: 'listen',
        title: b('第二课：认真听完一个故事', 'Lesson 2: listen to a whole story'),
        duration: 5,
        body: b(
          '一家人分享一天的经历时，可以约定轮流说、认真听。不同年龄的人看到的世界并不相同。先问“后来呢”，再急着给出建议。',
          'When sharing a day’s experiences, take turns speaking and listening. Different ages bring different perspectives. Ask what happened next before offering advice.',
        ),
        practice: b(
          '练习：请家人讲一件今天发生的小事。',
          'Practice: invite someone to share a small moment from today.',
        ),
      },
      {
        id: 'share',
        title: b('第三课：一起分担，彼此照看', 'Lesson 3: share the work and care'),
        duration: 6,
        body: b(
          '根据每个人的时间与能力分担家务，也关照身体不便或需要休息的人。家庭分工可以调整，重要的是相互商量与主动承担。',
          'Share chores according to each person’s time and ability, while considering those who need rest or assistance. Roles can change through discussion and initiative.',
        ),
        practice: b(
          '练习：主动认领一项适合自己的家务。',
          'Practice: volunteer for one suitable household task.',
        ),
      },
    ],
    quiz: {
      question: b(
        '家人分享一天的经历时，怎样做更合适？',
        'How can you respond when a family member shares their day?',
      ),
      options: [
        b('立即打断，给出自己的答案', 'Interrupt with an immediate answer'),
        b('认真倾听，再询问对方的感受', 'Listen fully, then ask how they felt'),
        b('一边看手机一边回应', 'Reply while focusing on a phone'),
      ],
      answer: 1,
      explanation: b(
        '示例解析：认真倾听和尊重感受，让每位家人都能够被看见。',
        'Sample explanation: listening and respecting feelings help every family member feel heard.',
      ),
    },
  },
]

export const venues = [
  {
    id: 'beijing-reading',
    region: 'beijing',
    activityId: 'DEMO-ACTIVITY-001',
    mark: '京',
    title: b('家书共读空间', 'Family Letter Reading Room'),
    city: b('北京 · 示例阵地', 'Beijing · sample venue'),
    address: b('演示文化街 18 号（虚构地址）', '18 Demo Culture Street (fictional address)'),
    hours: b('周二至周日 09:00–17:00（示例）', 'Tue–Sun 09:00–17:00 (sample)'),
    description: b(
      '以家庭共读、家书写作和口述故事为主题的示例公共文化空间。',
      'A sample public cultural space for family reading, letter writing and storytelling.',
    ),
    highlights: [
      b('家书展墙', 'Letter gallery'),
      b('亲子阅读桌', 'Family reading tables'),
      b('口述故事角', 'Storytelling corner'),
    ],
    stops: [b('入口导览', 'Welcome'), b('家书展墙', 'Letters'), b('共读空间', 'Reading')],
    x: 68,
    y: 27,
  },
  {
    id: 'zhejiang-academy',
    region: 'zhejiang',
    activityId: 'DEMO-ACTIVITY-002',
    mark: '浙',
    title: b('清风家训书院', 'Qingfeng Family Wisdom Academy'),
    city: b('浙江 · 示例阵地', 'Zhejiang · sample venue'),
    address: b('演示书院路 6 号（虚构地址）', '6 Demo Academy Road (fictional address)'),
    hours: b('周二至周日 09:30–16:30（示例）', 'Tue–Sun 09:30–16:30 (sample)'),
    description: b(
      '围绕古训今读、清廉教育和文化研学，组织可参与的阅读与书写体验。',
      'A sample academy for classical reading, integrity learning and participatory writing.',
    ),
    highlights: [
      b('家训文献展', 'Family wisdom display'),
      b('清廉学堂', 'Integrity classroom'),
      b('书写工坊', 'Writing workshop'),
    ],
    stops: [b('序厅', 'Introduction'), b('家训展厅', 'Wisdom gallery'), b('书写工坊', 'Workshop')],
    x: 74,
    y: 66,
  },
  {
    id: 'sichuan-workshop',
    region: 'sichuan',
    activityId: 'DEMO-ACTIVITY-003',
    mark: '川',
    title: b('竹院家风工坊', 'Bamboo Courtyard Workshop'),
    city: b('四川 · 示例阵地', 'Sichuan · sample venue'),
    address: b('演示竹院巷 12 号（虚构地址）', '12 Demo Bamboo Lane (fictional address)'),
    hours: b('周三至周日 10:00–17:00（示例）', 'Wed–Sun 10:00–17:00 (sample)'),
    description: b(
      '以家训手作、社区故事和邻里共学为主题，让每个人都能参与家风传习。',
      'A sample community workshop for family-principle crafts and neighbourhood storytelling.',
    ),
    highlights: [
      b('竹简手作', 'Bamboo-card craft'),
      b('邻里故事墙', 'Neighbourhood stories'),
      b('共享书桌', 'Shared study tables'),
    ],
    stops: [b('竹院入口', 'Courtyard'), b('故事墙', 'Stories'), b('手作桌', 'Craft tables')],
    x: 31,
    y: 68,
  },
] as const

export const activityTranslations: Record<
  string,
  { title: string; category: string; excerpt: string; content: string }
> = {
  'DEMO-ACTIVITY-001': {
    title: 'Read a family letter together',
    category: 'Family reading',
    excerpt: 'Start a thoughtful family conversation with a letter.',
    content:
      'Sample activity only. Read an original sample letter, share your understanding and write a message for a family member. The two-hour example includes a warm-up, conversation, writing and reflection. No real booking or fee is involved.',
  },
  'DEMO-ACTIVITY-002': {
    title: 'Family wisdom at the academy',
    category: 'Cultural learning',
    excerpt: 'Connect family principles with everyday life through reading and writing.',
    content:
      'Sample activity only. Explore family commitments through a display introduction, a short question session and a family promise card. The venue and arrangements are fictional.',
  },
  'DEMO-ACTIVITY-003': {
    title: 'A family promise on bamboo cards',
    category: 'Craft workshop',
    excerpt: 'Write a shared family commitment and bring it into daily life.',
    content:
      'Sample activity only. Discuss a family story, draft a shared commitment and write it on a paper bamboo card. Finish by sharing your work. This demonstration does not make a real reservation.',
  },
}
