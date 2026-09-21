export interface BilingualText {
  zh: string
  en: string
}
const text = (zh: string, en: string): BilingualText => ({ zh, en })

export interface MediaItem {
  id: string
  title: BilingualText
  category: 'letter' | 'documentary' | 'lecture'
  type: 'short' | 'replay'
  collection: BilingualText
  excerpt: BilingualText
  duration: string
  poster: string
  source: string
  transcript: BilingualText[]
}

export const mediaCatalog: MediaItem[] = [
  {
    id: 'letter-01',
    title: text('写给长大后的你', 'A letter to your future self'),
    category: 'letter',
    type: 'short',
    collection: text('一封家书 · 一份牵挂', 'Family letters'),
    excerpt: text(
      '把诚实、勤俭与担当写进一封家书，留给成长路上的每一个你。',
      'A short original letter about honesty, thrift and taking responsibility.',
    ),
    duration: '00:12',
    poster: '/pkg-content/static/media/family-letter.jpg',
    source: '/pkg-content/static/media/family-letter.mp4',
    transcript: [
      text(
        '亲爱的孩子，愿你心中有光，脚下有路。',
        'Dear child, may you find light in your heart and purpose in your steps.',
      ),
      text(
        '诚实待人，认真做事；珍惜每一餐，也珍惜每一次相聚。',
        'Be honest and diligent. Treasure every meal and every moment together.',
      ),
      text(
        '愿你把小家的温暖，化作服务大家的力量。',
        'May the warmth of your family inspire you to serve others.',
      ),
    ],
  },
  {
    id: 'everyday-01',
    title: text('家风，就在日常之间', 'Values in everyday life'),
    category: 'documentary',
    type: 'short',
    collection: text('帧藏家风 · 日常篇', 'Everyday family values'),
    excerpt: text(
      '从一粥一饭到邻里相助，用三个日常片段勾勒好家风。',
      'Three everyday moments: sharing a meal, helping a neighbour and keeping a promise.',
    ),
    duration: '00:12',
    poster: '/pkg-content/static/media/everyday-values.jpg',
    source: '/pkg-content/static/media/everyday-values.mp4',
    transcript: [
      text('一粥一饭，记得来之不易。', 'Remember the work behind every meal.'),
      text(
        '邻里之间，多一点体谅，多一份帮助。',
        'Offer understanding and practical help to your neighbours.',
      ),
      text(
        '答应的事情，认真做到；平凡的日子，用心过好。',
        'Keep your promises and live ordinary days with care.',
      ),
    ],
  },
  {
    id: 'lecture-01',
    title: text('清廉家风，从一件小事开始', 'Integrity starts with small choices'),
    category: 'lecture',
    type: 'replay',
    collection: text('家风讲堂 · 回放演示', 'Family values lecture · replay demo'),
    excerpt: text(
      '讲堂回放界面样例：以守信、节俭和公私分明为话题，展示播放与章节阅读。',
      'A replay interface sample exploring honesty, thrift and clear boundaries.',
    ),
    duration: '00:12',
    poster: '/pkg-content/static/media/integrity-talk.jpg',
    source: '/pkg-content/static/media/integrity-talk.mp4',
    transcript: [
      text(
        '把规矩记在心里，把诚信落实在行动中。',
        'Remember your principles and put honesty into practice.',
      ),
      text(
        '家事多商量，公私要分明。',
        'Discuss family matters together and keep public duties distinct.',
      ),
      text(
        '从今天的小事做起，让清廉成为习惯。',
        'Start with small choices today and make integrity a habit.',
      ),
    ],
  },
]

export interface HallPerson {
  id: string
  name: BilingualText
  era: BilingualText
  region: 'sichuan' | 'jiangsu'
  regionName: BilingualText
  theme: BilingualText
  book: BilingualText
  quote: BilingualText
  introduction: BilingualText
  notes: BilingualText[]
  sourceTitle: string
  sourceUrl: string
}

export const hallPeople: HallPerson[] = [
  {
    id: 'zhuge-liang',
    name: text('诸葛亮', 'Zhuge Liang'),
    era: text('三国 · 蜀汉', 'Three Kingdoms · Shu Han'),
    region: 'sichuan',
    regionName: text('四川 · 主题展', 'Sichuan · thematic gallery'),
    theme: text('静以修身，俭以养德', 'Self-cultivation and simple living'),
    book: text('诫子书', 'Letter of Admonition to My Son'),
    quote: text(
      '静以修身，俭以养德。',
      'Cultivate oneself through calmness; nurture virtue through thrift.',
    ),
    introduction: text(
      '诸葛亮留给后人的《诫子书》，将修身、治学与立志联系起来。本展以“静”和“俭”为线索，邀请你读一段家训，想一件可以实践的小事。',
      'The Letter of Admonition links self-cultivation, study and aspiration. This thematic gallery explores calmness and thrift through reading and reflection.',
    ),
    notes: [
      text(
        '家书：读懂长辈对成长与治学的期望。',
        'The letter: a parent’s hopes for study and growth.',
      ),
      text(
        '修身：在安静中整理目标，在日常中练习自律。',
        'Reflection: set goals and practise self-discipline.',
      ),
      text(
        '传习：把古代家训转化为今日可行的家庭约定。',
        'Practice: turn a traditional precept into a family commitment today.',
      ),
    ],
    sourceTitle: '中央纪委国家监委网站 · 勤俭日话勤俭',
    sourceUrl: 'https://www.ccdi.gov.cn/lswhn/wenhua/wenyuan/201810/t20181031_27023.html',
  },
  {
    id: 'yan-zhitui',
    name: text('颜之推', 'Yan Zhitui'),
    era: text('南北朝', 'Northern and Southern dynasties'),
    region: 'jiangsu',
    regionName: text('江苏 · 主题展', 'Jiangsu · thematic gallery'),
    theme: text('重实学，重家教', 'Practical learning and family education'),
    book: text('颜氏家训', 'Family Instructions of Master Yan'),
    quote: text('重实学，涉世务。', 'Pursue practical learning and engage with the world.'),
    introduction: text(
      '《颜氏家训》将个人经历、家庭教育与学习方法写成对子孙的告诫。展览从“勉学”和“涉务”出发，讨论如何把知识落实到生活。',
      'Family Instructions draws on life experience to discuss education and learning. This gallery considers how study can inform everyday choices.',
    ),
    notes: [
      text(
        '家教：把学习与品行放在共同成长的日常中。',
        'Education: build habits of learning and good conduct together.',
      ),
      text(
        '实学：学习不仅在书本，也在观察和实践中。',
        'Practical learning: knowledge grows through observation and action.',
      ),
      text(
        '家族文脉：以代际共读连接家庭记忆。',
        'Family heritage: connect generations through shared reading.',
      ),
    ],
    sourceTitle: '中国纪检监察杂志 · 颜之推诫子孙：重实学 涉世务',
    sourceUrl: 'https://zgjjjc.ccdi.gov.cn/bqml/bqxx/201603/t20160331_76976.html',
  },
]

export interface CulturalProduct {
  id: string
  name: BilingualText
  description: BilingualText
  category: BilingualText
  mark: string
  kind: 'public' | 'custom' | 'both'
  specification: BilingualText
  details: BilingualText[]
}

export const culturalProducts: CulturalProduct[] = [
  {
    id: 'reading-kit',
    name: text('家风共读 · 公益读本', 'Family reading · community kit'),
    description: text(
      '把一册家风带进课堂，让一场共读走进社区。',
      'Bring family stories to classrooms and community reading groups.',
    ),
    category: text('公益共读', 'Community reading'),
    mark: '家风',
    kind: 'public',
    specification: text(
      'A5 读本 · 32 页 · 样品规格',
      'A5 booklet · 32 pages · sample specification',
    ),
    details: [
      text(
        '内容：家书选读、共读问题卡与家庭约定页。',
        'Contents: sample letters, discussion cards and a family pledge.',
      ),
      text(
        '适用：学校、社区及公益共读活动。',
        'For schools, communities and volunteer reading activities.',
      ),
      text(
        '当前仅演示申领流程，没有真实库存和发货安排。',
        'This request demo has no live stock or delivery service.',
      ),
    ],
  },
  {
    id: 'family-book',
    name: text('一封家书 · 纪念册', 'A family letter · keepsake book'),
    description: text(
      '收好一封家书，也留住一代人的温暖记忆。',
      'Preserve family letters and memories in a keepsake book.',
    ),
    category: text('机构定制', 'Custom editions'),
    mark: '家书',
    kind: 'custom',
    specification: text(
      '硬面精装 · 主题封面 · 样品规格',
      'Hardcover · themed cover · sample specification',
    ),
    details: [
      text(
        '可选：机构主题页、家书选编、活动纪念页。',
        'Options: an organisation introduction, selected letters and an event page.',
      ),
      text(
        '数量、版权与制作方案需要人工确认。',
        'Quantity, rights and production details require review.',
      ),
      text(
        '提交后生成本机咨询记录，不生成报价或付款订单。',
        'Submitting creates a local inquiry record, without a quote or payment order.',
      ),
    ],
  },
  {
    id: 'precept-cards',
    name: text('清风入家 · 家训书签', 'Family precepts · bookmark set'),
    description: text(
      '一枚书签，一句约定；把好家风带在身边。',
      'A bookmark, a promise: carry family values into everyday reading.',
    ),
    category: text('家训文创', 'Literary gifts'),
    mark: '清风',
    kind: 'both',
    specification: text(
      '纸质书签 · 6 枚一组 · 样品规格',
      'Paper bookmarks · set of six · sample specification',
    ),
    details: [
      text(
        '公益版：用于课堂和社区阅读活动。',
        'Community edition: for school and neighbourhood reading.',
      ),
      text(
        '定制版：可讨论主题文字与机构纪念信息。',
        'Custom edition: discuss themed wording and commemorative details.',
      ),
      text(
        '示例商品图为原创排版示意，非实物照片。',
        'Product illustrations are original layout studies, not photographs.',
      ),
    ],
  },
]

export type CommerceKind = 'public' | 'custom'
export interface CommerceForm {
  organization: string
  quantity: string
  purpose: string
  agreed: boolean
}
export interface CommerceRequest {
  id: string
  productId: string
  kind: CommerceKind
  organization: string
  quantity: number
  purpose: string
  createdAt: string
  status: 'recorded' | 'cancelled'
}

export function validateCommerceForm(
  form: CommerceForm,
): 'organization' | 'quantity' | 'purpose' | 'agreement' | null {
  if (form.organization.trim().length < 2) return 'organization'
  if (
    !/^\d+$/.test(form.quantity.trim()) ||
    Number(form.quantity) < 1 ||
    Number(form.quantity) > 500
  )
    return 'quantity'
  if (form.purpose.trim().length < 8) return 'purpose'
  if (!form.agreed) return 'agreement'
  return null
}
