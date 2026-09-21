import type { AssistantMode } from './personalArchive'
import type { RegionId, SubmissionDraft } from './types'

export interface LocalizedText {
  zh: string
  en: string
}
export interface AssistantExample {
  id: string
  label: LocalizedText
  input: LocalizedText
  result: LocalizedText
  source?: LocalizedText
  corrected?: LocalizedText
  notes: LocalizedText[]
}
export interface AssistantTool {
  id: AssistantMode
  symbol: string
  label: LocalizedText
  description: LocalizedText
  promptLabel: LocalizedText
  examples: AssistantExample[]
}
const text = (zh: string, en: string): LocalizedText => ({ zh, en })
export const assistantTools: AssistantTool[] = [
  {
    id: 'letter',
    symbol: '书',
    label: text('家书创作', 'Family letter'),
    description: text(
      '从一件家常小事，展开一封真诚的信。',
      'Start a sincere letter with an everyday moment.',
    ),
    promptLabel: text(
      '想写给谁，想说些什么？',
      'Who is the letter for, and what would you like to say?',
    ),
    examples: [
      {
        id: 'letter-child',
        label: text('写给远行的孩子', 'To a child leaving home'),
        input: text(
          '给第一次离家求学的孩子写封信，想谈谈守信和照顾自己。',
          'Write to a child leaving home to study, about keeping promises and caring for themselves.',
        ),
        result: text(
          '亲爱的孩子：\n\n整理书柜时，我又看见了你小时候夹在书页里的叶子。想到你即将开始新的生活，心里有牵挂，也有期待。\n\n家里常说，答应的事情要认真完成。这不是要你事事完美，而是希望你珍惜别人的信任。遇到做不到的事，及时说明，也是一种诚实。\n\n出门在外，记得好好吃饭、按时休息，也给自己留一点慢下来的时间。遇见困难可以告诉我们，家一直是愿意听你说话的地方。\n\n愿你勇敢探索，也温柔待人。期待听见你的新故事。',
          'Dear child,\n\nWhile tidying the bookshelf, I found the leaf you pressed between its pages years ago. As you begin a new chapter, I feel both concern and hope.\n\nAt home, we often say that a promise deserves care. This does not mean you must be perfect. It means treating other people’s trust seriously. When a promise becomes impossible, explaining honestly is also a way to keep that trust.\n\nEat well, make time to rest, and leave yourself room to slow down. Tell us when life feels difficult. Home remains a place where someone wants to listen.\n\nExplore bravely and treat people kindly. I look forward to hearing your new stories.',
        ),
        notes: [
          text(
            '以具体回忆开头，避免空泛说教。',
            'Begin with a specific memory instead of abstract advice.',
          ),
          text(
            '保留邀请对话的结尾，不替收信人作决定。',
            'End with an invitation to talk, without deciding for the recipient.',
          ),
        ],
      },
      {
        id: 'letter-elder',
        label: text('写给家中长辈', 'To an older family member'),
        input: text(
          '给奶奶写一封感谢信，记得她总把热饭留给晚归的人。',
          'Write a thank-you letter to a grandmother who always saved a warm meal for anyone returning late.',
        ),
        result: text(
          '亲爱的奶奶：\n\n每次晚回家，总能在厨房看见一盏灯和一碗热饭。那些平常的夜晚，后来成了我最安心的回忆。\n\n您很少讲大道理，却总记得别人的需要。多留一双筷子，耐心听完一句话，把最好的那口菜夹给别人，都是您教会我的关爱。\n\n现在，也让我多照顾您一点。这个周末想陪您散散步，听您讲讲年轻时的故事。谢谢您把家的温暖，留在我们每个人心里。',
          'Dear Grandma,\n\nWhenever I came home late, a light was still on in the kitchen and a warm meal was waiting. Those ordinary evenings became some of my safest memories.\n\nYou rarely gave long speeches, but you always noticed what others needed. An extra pair of chopsticks, the patience to hear someone out, and a shared plate of food taught me what care looks like.\n\nNow I would like to care for you, too. This weekend, let us take a walk and talk about your younger days. Thank you for giving each of us a lasting sense of home.',
        ),
        notes: [
          text(
            '用行动表达感谢，让家书有具体落点。',
            'Express gratitude through a concrete next action.',
          ),
        ],
      },
    ],
  },
  {
    id: 'rules',
    symbol: '训',
    label: text('家训拟写', 'Family principles'),
    description: text(
      '把家里的好习惯，写成可以践行的约定。',
      'Turn everyday habits into practical shared commitments.',
    ),
    promptLabel: text('想留下怎样的家庭约定？', 'What commitment would your family like to make?'),
    examples: [
      {
        id: 'rules-trust',
        label: text('守信与倾听', 'Trust and listening'),
        input: text(
          '希望家人守信，也能在意见不同的时候耐心倾听。',
          'We want to keep our promises and listen patiently when we disagree.',
        ),
        result: text(
          '以诚相待，以信相守；遇事商量，认真倾听。\n\n我们的日常约定：\n一、答应之前想清楚，答应之后认真做。\n二、不能按时完成的事，提前说明并商量办法。\n三、意见不同也先听完，不用声音的大小代替道理。\n四、每周留一点相处时间，说说感谢，也谈谈困难。',
          'Meet one another honestly, keep trust carefully, discuss concerns, and listen fully.\n\nOur everyday commitments:\n1. Think before making a promise, and follow through with care.\n2. If a promise cannot be kept on time, explain early and agree on a new plan.\n3. Hear each other out when opinions differ. Volume is not a substitute for reason.\n4. Make time each week for gratitude and difficult conversations.',
        ),
        notes: [
          text(
            '家训由家人共同商量，不是一方单向要求。',
            'Agree on principles together; they are not one person’s demands.',
          ),
          text(
            '短句之后附具体行动，便于日常实践。',
            'Follow each principle with a practical action.',
          ),
        ],
      },
      {
        id: 'rules-thrift',
        label: text('惜物与分享', 'Care and sharing'),
        input: text(
          '想为家庭拟一段关于珍惜物品、减少浪费、乐于分享的家训。',
          'Draft family principles about caring for belongings, reducing waste, and sharing.',
        ),
        result: text(
          '一饭一物，知其来处；量需而用，与人分享。\n\n买东西前先看看家里有什么，吃饭时按需取用。\n旧物能修则修，闲置物品整理后送给需要的人。\n节约不是舍不得善待自己，而是让每一份资源得到珍惜。\n分享之前尊重对方的意愿，让关爱保有分寸。',
          'Know where food and belongings come from; use what you need and share with care.\n\nCheck what is already at home before buying something new. Take only the food you need.\nRepair what can be repaired, and offer unused items to people who want them.\nThrift does not mean refusing to care for yourself. It means valuing resources.\nAsk before sharing, and let kindness respect another person’s wishes.',
        ),
        notes: [
          text(
            '把“节约”写成可操作的小事，而不是口号。',
            'Describe thrift through concrete habits instead of slogans.',
          ),
        ],
      },
    ],
  },
  {
    id: 'polish',
    symbol: '润',
    label: text('文稿润色', 'Polishing comparison'),
    description: text(
      '对照原句与样例，看看表达如何更具体。',
      'Compare an original passage with a clearer sample.',
    ),
    promptLabel: text('原文或需要改进的表达', 'Original text or wording you would like to improve'),
    examples: [
      {
        id: 'polish-meal',
        label: text('把“很辛苦”写具体', 'Make “working hard” concrete'),
        input: text(
          '妈妈每天下班很累。她还会给我们做饭。我觉得她很辛苦。我们要多关心她。',
          'Mum is tired after work every day. She still cooks for us. I think she works very hard. We should care about her more.',
        ),
        result: text(
          '妈妈下班回到家，常常来不及坐下，就走进厨房准备晚饭。水声、锅铲声和饭菜的香气，陪我们度过一个个平常的傍晚。\n\n过去，我把这些照顾当成习惯。后来才明白，家的温暖也需要有人回应。今天起，我想先接过她手里的菜，问一句：“还有什么我能帮忙的？”',
          'When Mum comes home from work, she often starts preparing dinner before she has even sat down. Running water, the sound of a spatula, and the smell of food fill our ordinary evenings.\n\nI used to take that care for granted. Now I understand that the warmth of a home deserves a response. Today, I want to take the groceries from her hands and ask, “What else can I help with?”',
        ),
        notes: [
          text('用声音和动作替换笼统形容。', 'Replace broad descriptions with sounds and actions.'),
          text(
            '减少重复，把结尾落在“我能做什么”。',
            'Reduce repetition and end with something the writer can do.',
          ),
          text(
            '这是预置对照，不是对用户新输入的实时润色。',
            'This is a preset comparison, not live editing of new input.',
          ),
        ],
      },
      {
        id: 'polish-neighbor',
        label: text('让邻里故事更连贯', 'Connect a neighbor story'),
        input: text(
          '邻居爷爷的灯坏了。爸爸去帮忙了。修好了。爷爷很高兴。爸爸说互相帮助是应该的。',
          'Our older neighbor had a broken light. Dad went to help. It was fixed. The neighbor was happy. Dad said people should help each other.',
        ),
        result: text(
          '邻居爷爷家的灯坏了，爸爸带上工具，过去帮他检查。没过多久，屋里重新亮了起来。\n\n爷爷笑着道谢，爸爸说：“住得近，遇到事情就互相照应。”那天我才懂得，邻里之间的温暖，常常就是有人愿意为你多走几步路。',
          'When our older neighbor’s light stopped working, Dad took his tools over to check it. Before long, the room was bright again.\n\nOur neighbor thanked him with a smile. “We live close by,” Dad replied. “We can look out for each other.” That day I understood that neighborly warmth can be as simple as someone being willing to walk a few extra steps for you.',
        ),
        notes: [
          text(
            '合并短句，保留事情的起因、行动和感受。',
            'Connect short sentences while preserving the cause, action, and reflection.',
          ),
        ],
      },
    ],
  },
  {
    id: 'ocr',
    symbol: '识',
    label: text('手稿校对', 'Handwriting proofreading'),
    description: text(
      '体验手稿对照与校字步骤，当前没有识别引擎。',
      'Try comparing a manuscript and correcting text. No recognition engine is connected.',
    ),
    promptLabel: text('校对备注', 'Proofreading note'),
    examples: [
      {
        id: 'ocr-trust',
        label: text('守信手记样卡', 'Trust note sample'),
        input: text(
          '请对照这张演示手稿，检查文字与标点。',
          'Compare this sample manuscript and check the wording and punctuation.',
        ),
        source: text(
          '答应的事，用心完成。\n借来的东西，按时归还。\n以诚待人，认真倾听。\n家风藏在每日的小事里，\n也留在彼此的信任里。',
          'Keep promises with care.\nReturn borrowed things on time.\nBe honest, and listen closely.\nFamily values live in everyday acts,\nand in the trust we share.',
        ),
        result: text(
          '答应的事用心完成\n借来的东西按时归还\n以诚待人认真倾听\n家风藏在每日的小事里\n也留在彼此的信住里[待校]',
          'Keep promises with care\nReturn borrowed things on time\nBe honest and listen closely\nFamily values live in everyday acts\nand in the trnst we share [check]',
        ),
        corrected: text(
          '答应的事，用心完成。\n借来的东西，按时归还。\n以诚待人，认真倾听。\n家风藏在每日的小事里，也留在彼此的信任里。',
          'Keep promises with care.\nReturn borrowed things on time.\nBe honest, and listen closely.\nFamily values live in everyday acts, and in the trust we share.',
        ),
        notes: [
          text(
            '样例故意保留“信住”，对照后应改为“信任”。',
            'The sample intentionally uses “trnst”; the source reads “trust”.',
          ),
          text(
            '按原意补齐标点，不凭空补充原稿没有的内容。',
            'Restore punctuation without inventing missing content.',
          ),
          text(
            '此样卡由页面排版绘制，并非上传图片或真实OCR输出。',
            'This card is drawn with page text, not an uploaded image or real OCR output.',
          ),
        ],
      },
      {
        id: 'ocr-reading',
        label: text('读书手记样卡', 'Reading note sample'),
        input: text(
          '检查读书手记中的缺失标点和待校字。',
          'Check the missing punctuation and uncertain word in this reading note.',
        ),
        source: text(
          '每日读一页书，\n认真问一个问题。\n家人一起商量，\n让想法在倾听中生长。',
          'Read one page each day.\nAsk one thoughtful question.\nTalk it through together.\nLet ideas grow through listening.',
        ),
        result: text(
          '每日读一页书\n认真问一个问题\n家人一起商量\n让想法在倾听中生张[待校]',
          'Read one page each day\nAsk one thoughtful question\nTalk it through together\nLet ideas grov through listening [check]',
        ),
        corrected: text(
          '每日读一页书，认真问一个问题。\n家人一起商量，让想法在倾听中生长。',
          'Read one page each day, and ask one thoughtful question.\nTalk it through together, and let ideas grow through listening.',
        ),
        notes: [
          text('样例中的“生张”应对照改为“生长”。', 'The sample’s “grov” should read “grow”.'),
          text(
            '只能人工比较预置样卡，未调用识别服务。',
            'This is a manual comparison of a preset card, with no recognition service.',
          ),
        ],
      },
    ],
  },
  {
    id: 'help',
    symbol: '问',
    label: text('使用帮助', 'Platform help'),
    description: text(
      '了解本机投稿、模拟评审和草稿保存。',
      'Learn how local submissions, simulated reviews and drafts work.',
    ),
    promptLabel: text('想了解哪项功能？', 'Which feature would you like to understand?'),
    examples: [
      {
        id: 'help-submit',
        label: text('投稿与进度查询', 'Submit and track'),
        input: text('怎样投稿并查询评审进度？', 'How do I submit a work and track its review?'),
        result: text(
          '1. 打开“家风投稿”，选择通道、体裁和地区，可添加最多3个主题。\n2. 标题填写2–50字，正文至少20字。附件只保存本机元数据，不会上传到服务端。\n3. 阅读演示须知并勾选确认后提交，系统会生成DEMO-开头的编号。\n4. 在“评审公示”输入编号，或从“个人中心”查看进度和意见。\n5. 退回作品可修改后使用同一编号重投，原评语保留。\n\n这些操作仅在当前设备演示，没有真实征集、专家身份验证或官方评审。',
          '1. Open Contribute and choose a channel, genre, and region. You may add up to three themes.\n2. Use a title of 2–50 characters and a body of at least 20 characters. Attachments store local metadata only; they are not uploaded to a server.\n3. Read and accept the demo notice, then submit to receive an ID beginning with DEMO-.\n4. Enter that ID in Reviews, or open progress and feedback from My account.\n5. Returned works can be revised under the same ID, with previous feedback retained.\n\nThese actions are simulated on this device. There is no real submission call, verified expert identity or official review.',
        ),
        notes: [
          text(
            '正式征集规则、评审层级和版权协议仍待业务确认。',
            'Official submission rules, review stages and copyright terms still require confirmation.',
          ),
        ],
      },
      {
        id: 'help-draft',
        label: text('草稿与示例存档', 'Drafts and saved samples'),
        input: text(
          '退出后草稿还在吗？怎样找回助手示例？',
          'Will my draft remain after leaving? How do I find saved assistant samples?',
        ),
        result: text(
          '填写投稿表单时，页面会尝试自动保存到当前设备。再次进入投稿页可恢复草稿；保存失败时页面会显示提示。\n\n助手结果需要点击“保存示例”，之后可到“个人中心”的摘抄与存档中打开。复制内容只写入剪贴板，不会自动创建草稿。\n\n把示例转入投稿前会检查现有草稿：默认保留原稿，普通草稿需要明确选择后才替换；退回修改草稿不会被助手覆盖。\n\n清理浏览器或小程序缓存可能删除本机记录。当前没有云端同步、真实AI生成或手稿识别。',
          'The contribution form attempts to save changes on this device automatically. Return to the form to restore the draft. A message appears if saving fails.\n\nAssistant results are saved only when you select Save sample. Find them in Notes and archive in My account. Copying text uses the clipboard and does not create a draft.\n\nBefore transferring a sample to Contribute, the assistant checks for an existing draft. It keeps the current draft by default and replaces an ordinary draft only after an explicit choice. Revision drafts are never overwritten by the assistant.\n\nClearing browser or mini-program storage may delete local records. There is no cloud sync, live AI generation or handwriting recognition.',
        ),
        notes: [
          text(
            '不要把本机保存状态理解为已提交到真实平台。',
            'Local saving does not mean a real platform has received the content.',
          ),
        ],
      },
    ],
  },
  {
    id: 'knowledge',
    symbol: '知',
    label: text('家风知识问答', 'Family-values Q&A'),
    description: text(
      '阅读可追溯的知识卡，区分家风、家训与日常行动。',
      'Read source-labeled cards linking family values, principles and everyday actions.',
    ),
    promptLabel: text('想了解的家风知识', 'Your family-values question'),
    examples: [
      {
        id: 'knowledge-difference',
        label: text('家风与家训的区别', 'Values and principles'),
        input: text(
          '家风和家训有什么区别？',
          'How do family values differ from written family principles?',
        ),
        result: text(
          '知识卡 JF-K01 · 原创编辑示例\n\n家训可以理解为家人共同表达的准则；家风则更多体现在长期相处中形成的习惯与氛围。写下“以诚相待”是一条家训，答应之后认真做、做不到时及时说明，是把它带进生活的行动。\n\n可以从一次家庭讨论开始：每人提出一件希望保持的小事，商量一个本周能做到的约定，再一起回顾。不同家庭可以有不同表达，不必追求统一口号。',
          'Knowledge card JF-K01 · Original editorial sample\n\nWritten family principles express shared commitments. Family values also live in habits and the atmosphere that develops over time. “Be honest” is a principle; keeping a promise, or explaining promptly when it becomes impossible, puts it into practice.\n\nBegin with a family conversation. Each person suggests a small habit worth keeping, agrees on one practical action for the week, and reviews it together. Families can use different language without adopting a single slogan.',
        ),
        notes: [
          text(
            '来源：平台原创知识卡 JF-K01；用于展示知识条目引用方式。',
            'Source: original platform knowledge card JF-K01, demonstrating a traceable entry.',
          ),
          text(
            '不是实时检索，不引用未经核验的古籍原文。',
            'This is not live retrieval and does not quote unverified classical text.',
          ),
        ],
      },
      {
        id: 'knowledge-talk',
        label: text('怎样开展家庭共读', 'Plan a shared reading'),
        input: text(
          '如何让家风共读更容易参与？',
          'How can a family reading session be more welcoming?',
        ),
        result: text(
          '知识卡 JF-K02 · 原创编辑示例\n\n先选择一段适合家人理解的短文，约定十分钟，不把共读变成考试。轮流读一句，也允许只听不读。\n\n读完后可以问：“哪句话让你想起家里的一件事？”鼓励讲具体经历，避免比较谁答得更好。最后商量一件小行动，例如共同整理旧书或向长辈询问一段记忆。尊重每个人的意愿与节奏。',
          'Knowledge card JF-K02 · Original editorial sample\n\nChoose a short passage that everyone can understand and set aside ten minutes. Keep reading separate from testing. Take turns with a sentence, while allowing anyone to listen instead.\n\nAfterward, ask which line recalled a moment at home. Welcome specific experiences instead of ranking answers. Agree on one small action, such as sorting old books or asking an elder about a memory. Respect each person’s pace and willingness.',
        ),
        notes: [
          text(
            '来源：平台原创共读活动卡 JF-K02。',
            'Source: original platform shared-reading card JF-K02.',
          ),
          text(
            '正式知识库需经过内容审校后接入。',
            'A production knowledge base requires editorial review.',
          ),
        ],
      },
    ],
  },
  {
    id: 'compliance',
    symbol: '审',
    label: text('内容审核样例', 'Content review sample'),
    description: text(
      '查看隐私、出处与授权的审核报告样例，正式结论由人工确认。',
      'Explore sample privacy, attribution and permission findings for human review.',
    ),
    promptLabel: text('待审核文本或备注', 'Text or review note'),
    examples: [
      {
        id: 'review-privacy',
        label: text('个人信息与授权', 'Privacy and permission'),
        input: text(
          '预设稿写出了邻居的完整电话，并附了一张未征得同意的家庭照片。',
          'The preset includes a neighbor’s full phone number and a family photo shared without permission.',
        ),
        result: text(
          '审核报告样例 · JF-R01\n\n待修改：正文出现个人联系方式。建议删除或替换为不识别个人的演示内容。\n待确认：家庭照片中人物的使用授权尚未说明。建议确认授权，或换为自有且获准使用的素材。\n复核建议：作者检查正文、附件与署名；由内容人员确认后再进入公开展示。\n该报告针对预设案例，不会检查当前新输入，不构成法律意见或真实审核通过。',
          'Sample review report · JF-R01\n\nRevise: personal contact information appears in the preset. Remove it or replace it with non-identifying sample content.\nConfirm: permission for people shown in a family photo is unspecified. Confirm permission or use authorized original material.\nHuman review: the author checks text, attachments and attribution before an editor considers publication.\nThis report concerns the preset only. It does not analyze new input and is neither legal advice nor an actual approval.',
        ),
        notes: [
          text(
            '样例状态：需要修改；没有拦截或提交到真实审核流程。',
            'Sample state: revision needed. Nothing is blocked or submitted to a real review process.',
          ),
          text(
            '后续需配置正式审核规则、申诉和人工复核。',
            'Production needs reviewed rules, appeals and human checks.',
          ),
        ],
      },
      {
        id: 'review-source',
        label: text('引用与出处核对', 'Check quotations and sources'),
        input: text(
          '预设家书使用了一句未标出处的网络名言。',
          'The preset family letter includes an online quotation without attribution.',
        ),
        result: text(
          '审核报告样例 · JF-R02\n\n待核实：引用语句没有可靠出处，不能仅凭网络转发归于历史人物。\n修改建议：找到可核对版本后补充来源；无法核实时，可删去署名与引号，改写成自己的真实感受。\n人工复核项：引用范围、素材授权与事实表达。\n这里只展示报告结构，不执行查重、事实核验、敏感词拦截或正式合规认证。',
          'Sample review report · JF-R02\n\nVerify: a quoted phrase has no reliable source. Online circulation alone does not establish attribution to a historical figure.\nSuggested edit: locate a verifiable edition and supply the source. If it cannot be confirmed, remove the attribution and quotation marks and express your own experience.\nHuman checks: quotation scope, material permission and factual wording.\nThis demonstrates report structure only, without plagiarism detection, fact checking, content blocking or compliance certification.',
        ),
        notes: [
          text(
            '来源：原创审核流程案例，不是针对你的内容的判断。',
            'Source: original review-process scenario, not a judgment about your content.',
          ),
        ],
      },
    ],
  },
  {
    id: 'storyboard',
    symbol: '剧',
    label: text('图文短剧分镜', 'Illustrated storyboard'),
    description: text(
      '把预设家风故事拆成画面、台词与镜头，手工调整分镜文本。',
      'Explore a preset story through shots, dialogue and editable scene descriptions.',
    ),
    promptLabel: text('故事梗概或分镜备注', 'Story outline or storyboard note'),
    examples: [
      {
        id: 'story-meal',
        label: text('一盏晚归的灯', 'A light left on'),
        input: text(
          '把家人为晚归的人留饭的故事，写成三个镜头的短剧。',
          'Turn a story about saving a meal for a late arrival into three scenes.',
        ),
        result: text(
          '镜头一｜厨房·夜｜全景·4秒\n画面：暖灯亮着，桌上放着一碗盖好的饭。\n台词：奶奶：先别收，还有人没回来。\n\n镜头二｜门口·夜｜近景·4秒\n画面：孩子推门，奶奶把饭放到桌前。\n台词：孩子：您怎么还没睡？奶奶：饭热着，慢慢吃。\n\n镜头三｜厨房·翌日｜中景·4秒\n画面：孩子主动洗碗，给奶奶倒水。\n台词：孩子：今天换我照顾您。',
          'Scene 1 | Kitchen at night | Wide shot, 4 seconds\nVisual: a warm light and a covered bowl on the table.\nDialogue: Grandma: Leave it there; someone is still coming home.\n\nScene 2 | Doorway at night | Close shot, 4 seconds\nVisual: a child enters; Grandma sets the meal down.\nDialogue: Child: Why are you still awake? Grandma: The food is warm. Take your time.\n\nScene 3 | Kitchen next day | Medium shot, 4 seconds\nVisual: the child washes dishes and pours water for Grandma.\nDialogue: Child: Today, let me look after you.',
        ),
        notes: [
          text(
            '原创分镜预设；画面以文字示意，没有生成图片、声音或视频。',
            'Original preset storyboard; visuals are described in text. No images, audio or video are generated.',
          ),
          text(
            '每一空行分隔一个镜头，下方卡片随你的编辑同步。',
            'A blank line separates scenes. Preview cards update as you edit.',
          ),
        ],
      },
      {
        id: 'story-promise',
        label: text('还书的约定', 'The borrowed book'),
        input: text(
          '用三个镜头展示按时归还借书的小故事。',
          'Tell a three-scene story about returning a borrowed book on time.',
        ),
        result: text(
          '镜头一｜书桌·傍晚｜近景·4秒\n画面：孩子翻开书，看到写着归还日期的便签。\n台词：孩子：今天该还书了。\n\n镜头二｜街道·傍晚｜中景·4秒\n画面：孩子把书装进袋子，和家人一起出门。\n台词：家人：答应的事情，记得认真做。\n\n镜头三｜邻居家门口｜近景·4秒\n画面：孩子递回书，朋友微笑接过。\n台词：孩子：谢谢你的书，我很喜欢。朋友：下次一起读。',
          'Scene 1 | Desk at dusk | Close shot, 4 seconds\nVisual: a child opens a book and sees a note with its return date.\nDialogue: Child: It is due back today.\n\nScene 2 | Street at dusk | Medium shot, 4 seconds\nVisual: the child packs the book and leaves with a family member.\nDialogue: Family member: Give your promises care.\n\nScene 3 | Neighbor’s doorway | Close shot, 4 seconds\nVisual: the child returns the book; a friend smiles.\nDialogue: Child: Thank you. I loved this book. Friend: Let us read together next time.',
        ),
        notes: [
          text(
            '可手工编辑镜头与台词，保存后可在个人中心恢复。',
            'Edit scenes and dialogue by hand, then save and reopen from My account.',
          ),
          text(
            '未执行图像生成、视频合成或上传素材。',
            'No image generation, video rendering or material upload takes place.',
          ),
        ],
      },
    ],
  },
]

export function getAssistantTool(mode: AssistantMode): AssistantTool {
  return assistantTools.find((tool) => tool.id === mode) ?? assistantTools[0]!
}
export function getAssistantExample(mode: AssistantMode, id?: string): AssistantExample {
  const tool = getAssistantTool(mode)
  return tool.examples.find((example) => example.id === id) ?? tool.examples[0]!
}
export function createAssistantDraft(
  mode: AssistantMode,
  result: string,
  region: RegionId,
  language: 'zh' | 'en' = 'zh',
): SubmissionDraft {
  if (['help', 'knowledge', 'compliance'].includes(mode))
    throw new Error('帮助回答或审核资料不作为投稿作品，请选择创作模式。')
  if (!result.trim() || result.length > 10000)
    throw new Error('请先查看或完善不超过10000字的示例结果。')
  const titles = {
    letter: text('给家人的一封信（示例）', 'A family letter (sample)'),
    rules: text('我们的家庭约定（示例）', 'Our family commitments (sample)'),
    polish: text('生活里的家风（示例）', 'Family values in everyday life'),
    ocr: text('家训手记（校对示例）', 'Family note (proofreading sample)'),
    storyboard: text('家风短剧分镜（示例）', 'Family storyboard (sample)'),
    help: text('', ''),
    knowledge: text('', ''),
    compliance: text('', ''),
  }
  return {
    title: titles[mode][language],
    content: result.trim(),
    genre: mode === 'letter' ? 'letter' : mode === 'polish' ? 'essay' : 'family-rules',
    channel: 'community',
    region: region === 'all' ? 'beijing' : region,
    author: '',
    copyrightAccepted: false,
    themes: [],
    attachments: [],
  }
}
export interface DraftTransferRepository {
  getDraft(): SubmissionDraft | null
  saveDraft(draft: SubmissionDraft): SubmissionDraft
}
export type AssistantTransferResult =
  | { status: 'saved'; draft: SubmissionDraft }
  | {
      status: 'conflict' | 'revision-protected'
      existing: SubmissionDraft
      candidate: SubmissionDraft
    }
/** 默认只读检查冲突；只有无草稿或明确允许替换普通草稿时才写入。 */
export function transferAssistantDraft(
  repo: DraftTransferRepository,
  candidate: SubmissionDraft,
  replaceExisting = false,
): AssistantTransferResult {
  if (candidate.editingWorkId) throw new Error('助手示例只能创建新稿，不能携带修改稿编号。')
  const existing = repo.getDraft()
  if (existing?.editingWorkId) return { status: 'revision-protected', existing, candidate }
  if (existing && !replaceExisting) return { status: 'conflict', existing, candidate }
  return { status: 'saved', draft: repo.saveDraft(candidate) }
}
