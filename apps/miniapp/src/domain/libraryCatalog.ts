import type { Classic, GenreId, ThemeId, Work } from './types'
export type ReadingItem = Classic | Work
export interface ReadingChapter {
  id: string
  title: string
  paragraphs: string[]
}
export interface ReadingDocument {
  id: string
  title: string
  subtitle: string
  author: string
  excerpt: string
  chapters: ReadingChapter[]
  genre: GenreId
  themes: ThemeId[]
  isClassic: boolean
  translated: boolean
}
interface BookMetadata {
  title: string
  subtitle: string
  excerpt: string
  genre: GenreId
  themes: ThemeId[]
  chapterTitles: string[]
  englishChapters: { title: string; paragraphs: string[] }[]
}
const books: Record<string, BookMetadata> = {
  'DEMO-CLASSIC-001': {
    title: 'China in Family Letters',
    subtitle: 'Sample national volume · letters and daily life',
    excerpt: 'Discover everyday care in each carefully written word.',
    genre: 'letter',
    themes: ['filial', 'family-history'],
    chapterTitles: ['第一章 · 见字如面', '第二章 · 日常有光', '第三章 · 留给明天'],
    englishChapters: [
      {
        title: 'Chapter 1 · A letter brings us closer',
        paragraphs: [
          'A family letter needs no elaborate language. Ask how your family is doing, then describe a small moment from your day. Writing your care down thoughtfully creates a warm connection.',
        ],
      },
      {
        title: 'Chapter 2 · Light in everyday life',
        paragraphs: [
          'A family letter may describe a bowl of warm soup, a flower opening in the yard, or a difficulty to discuss together. Real everyday experiences give each expression its own meaning.',
        ],
      },
      {
        title: 'Chapter 3 · Leave something for tomorrow',
        paragraphs: [
          'Keep the letter carefully, and keep respect, understanding and care alive through daily actions. Let family letters become a record of growing together.',
        ],
      },
    ],
  },
  'DEMO-CLASSIC-002': {
    title: 'Notes on Jiangnan Family Wisdom',
    subtitle: 'Sample regional volume · Zhejiang',
    excerpt: 'Start with reading, keeping promises and caring for belongings.',
    genre: 'family-rules',
    themes: ['heritage', 'integrity'],
    chapterTitles: ['勤读', '守信'],
    englishChapters: [
      {
        title: 'Read a little each day',
        paragraphs: [
          'Reading is not about remembering everything at once. It is about understanding a little more each day. Read one page with your family and exchange a question to open a window into everyday life.',
        ],
      },
      {
        title: 'Keep your promises',
        paragraphs: [
          'Think carefully before making a promise, and follow through after making it. If something cannot be done, explain in time. Honesty helps shared rules become habits of mutual respect.',
        ],
      },
    ],
  },
  'DEMO-CLASSIC-003': {
    title: 'Family Values in a Bamboo Courtyard',
    subtitle: 'Sample regional volume · Sichuan',
    excerpt: 'A courtyard and the care shared across generations tell a lasting story.',
    genre: 'family-notes',
    themes: ['neighbor', 'filial'],
    chapterTitles: ['照看', '传承'],
    englishChapters: [
      {
        title: 'Care for one another',
        paragraphs: [
          'A greeting between neighbours and a moment of listening within a family are valuable acts of care. Willingness to stop and hear someone out is a beginning of respect.',
        ],
      },
      {
        title: 'Pass it on',
        paragraphs: [
          'Not every experience needs to become a rule. Explain your choices and listen to younger people’s ideas. Let inheritance happen through an equal exchange.',
        ],
      },
    ],
  },
}
const worksEnglish: Record<
  string,
  { title: string; excerpt: string; author: string; themes: ThemeId[]; paragraphs: string[] }
> = {
  'DEMO-WORK-001': {
    title: 'Let Everyday Life Become a Family Letter',
    excerpt: 'A lamp at the table and a leaf in a book carry daily life to someone far away.',
    author: 'Lin He (fictional author)',
    themes: ['filial', 'family-history'],
    paragraphs: [
      'Dear child,',
      'While tidying the bookcase yesterday, I found the ginkgo leaf you placed between the pages as a child. The leaf has dried, but the memory of our walk remains.',
      'Our family has no expensive heirlooms. Your grandmother taught us to keep promises; your grandfather taught us to treat others sincerely. I hope to pass on the same small daily actions: fulfil your promises, ask how you can help someone in difficulty, and wait for the person still preparing dinner.',
      'However far you travel, may you always keep a light in your heart for family.',
    ],
  },
  'DEMO-WORK-002': {
    title: 'Four Seasons at One Table',
    excerpt: 'Three generations share what it means to appreciate and care.',
    author: 'Xu An (fictional author)',
    themes: ['filial', 'neighbor'],
    paragraphs: [
      'Our dining table is old, with a small scratch at one corner. Grandfather says I made it while learning to set the table.',
      'In spring we share fresh greens with neighbours. In summer, a warm bowl of porridge waits for whoever comes home late. In autumn, grandmother packs extra fruit to share. In winter, the smell of soup invites everyone to slow down.',
      'Family values are more than words on a wall. They mean knowing each grain of rice took work, keeping a chair for someone else, and turning a meal into a time of care.',
    ],
  },
  'DEMO-WORK-003': {
    title: 'A Promise in the Bamboo Shade',
    excerpt: 'A borrowed tool preserves a shared lesson about keeping promises.',
    author: 'Zhou Ning (fictional author)',
    themes: ['heritage', 'neighbor'],
    paragraphs: [
      'As a child I helped grandfather repair the bamboo fence. A neighbour lent us a small saw. After using it, grandfather always cleaned it and returned it himself.',
      'I asked whether we could return it tomorrow. He smiled: the object may be small, but the promise still matters.',
      'Years later, I still remember those words in the bamboo shade. A family principle may be brief, but practising it takes time. Begin by returning one borrowed item with care, and let trust grow through small actions.',
    ],
  },
  'DEMO-WORK-004': {
    title: 'Integrity Begins at the Front Door',
    excerpt: 'Bring honesty and self-discipline into everyday family life.',
    author: 'Chen Yan (fictional author)',
    themes: ['integrity'],
    paragraphs: [
      'Family values turn simple principles into a way of life. Honesty, self-discipline and respect belong to everyday actions as much as to a classroom or a book.',
      'Do we keep a small promise? Can we explain a decision honestly to our family? Do we respect shared rules even when we have an advantage? These choices make family education tangible.',
      'Integrity can begin at home and extend into the wider world through mutual understanding and thoughtful reminders.',
    ],
  },
}
export function isClassic(item: ReadingItem): item is Classic {
  return 'chapterCount' in item
}
function sourceParagraphs(content: string, richText = false) {
  return content
    .split(richText ? /\n+/ : /\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part && !/^【演示原创/.test(part))
}
export function readingDocument(item: ReadingItem, locale: 'zh' | 'en'): ReadingDocument {
  const book = books[item.id]
  const work = worksEnglish[item.id]
  const classic = isClassic(item)
  const metadata = book ?? work
  const useEnglish = locale === 'en' && Boolean(metadata)
  const selectedThemes = !classic && item.themes?.length ? item.themes : (metadata?.themes ?? [])
  const title = useEnglish ? metadata!.title : item.title
  let chapters: ReadingChapter[]
  if (classic && item.chapters?.length) {
    chapters = item.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      paragraphs: sourceParagraphs(chapter.body),
    }))
  } else if (classic && book) {
    if (useEnglish)
      chapters = book.englishChapters.map((entry, index) => ({
        id: `chapter-${index + 1}`,
        ...entry,
      }))
    else {
      chapters = []
      for (const part of sourceParagraphs(item.content)) {
        if (book.chapterTitles.includes(part))
          chapters.push({ id: `chapter-${chapters.length + 1}`, title: part, paragraphs: [] })
        else {
          if (!chapters.length)
            chapters.push({ id: 'chapter-1', title: item.title, paragraphs: [] })
          chapters[chapters.length - 1]!.paragraphs.push(part)
        }
      }
    }
  } else
    chapters = [
      {
        id: 'chapter-1',
        title: locale === 'en' ? 'Full text' : '正文',
        paragraphs:
          useEnglish && work
            ? work.paragraphs
            : sourceParagraphs(item.content, !classic && Boolean(item.contentDelta)),
      },
    ]
  if (!chapters.length)
    chapters = [
      {
        id: 'chapter-1',
        title: locale === 'en' ? 'Full text' : '正文',
        paragraphs: [item.content],
      },
    ]
  return {
    id: item.id,
    title,
    subtitle: classic
      ? useEnglish && book
        ? book.subtitle
        : item.subtitle
      : locale === 'en'
        ? item.isDemo
          ? 'Sample work · reading selection'
          : 'Family story · reading selection'
        : item.isDemo
          ? '演示作品 · 家风选读'
          : '家风作品 · 家风选读',
    author: useEnglish ? (work?.author ?? 'Prototype editorial team (fictional)') : item.author,
    excerpt: useEnglish ? metadata!.excerpt : item.excerpt,
    chapters,
    genre: classic ? (book?.genre ?? 'family-rules') : item.genre,
    themes: [...selectedThemes],
    isClassic: classic,
    translated: useEnglish,
  }
}
export interface ReadingGlossary {
  id: string
  term: string
  english: string
  meaning: string
  meaningEn: string
  prompt: string
  promptEn: string
}
export const readingGlossary: ReadingGlossary[] = [
  {
    id: 'promise',
    term: '约定',
    english: 'A shared commitment',
    meaning: '彼此商量后共同认可、愿意认真履行的一件事。约定可以很小，关键在于持续地做到。',
    meaningEn:
      'Something people discuss, agree on and intend to carry out. A commitment can be small; following through is what gives it meaning.',
    prompt: '你与家人可以共同约定哪一件日常小事？',
    promptEn: 'What small everyday commitment could you make with your family?',
  },
  {
    id: 'principle',
    term: '家训',
    english: 'A family principle',
    meaning: '家庭愿意共同记住和实践的行为准则。把意思讲清楚，也把具体做法一起商量好。',
    meaningEn:
      'A principle a family chooses to remember and practise together. Discuss both its meaning and the actions that make it tangible.',
    prompt: '用一句简短的话，写下你想践行的家庭约定。',
    promptEn: 'Write a short sentence describing a family commitment you want to practise.',
  },
  {
    id: 'care',
    term: '牵挂',
    english: 'Care across distance',
    meaning: '这里指对家人持续的关心。一次问候、一封家书，都可以把这种关心具体地表达出来。',
    meaningEn:
      'Here it means sustained care for family. A greeting or a letter can turn that feeling into a concrete expression.',
    prompt: '你想在下一次问候中，认真询问家人的哪件小事？',
    promptEn: 'What small part of a family member’s life would you like to ask about?',
  },
  {
    id: 'trust',
    term: '守信',
    english: 'Keep a promise',
    meaning: '答应之前认真考虑，答应之后努力完成；如果情况改变，及时说明也是对他人的尊重。',
    meaningEn:
      'Think before agreeing, follow through afterwards, and explain promptly when circumstances change.',
    prompt: '写下一个你愿意认真完成的小约定。',
    promptEn: 'Write one small promise you intend to keep.',
  },
  {
    id: 'inherit',
    term: '传承',
    english: 'Pass it on',
    meaning: '把值得珍惜的经验与价值传给后来的人，也允许他们结合自己的生活作出理解与实践。',
    meaningEn:
      'Pass valuable experiences and principles to the next generation while allowing them to interpret and practise them in their own lives.',
    prompt: '你想保留家中的哪一种习惯？又希望怎样改变它？',
    promptEn: 'Which family habit would you preserve, and how might you adapt it?',
  },
  {
    id: 'thrift',
    term: '惜物',
    english: 'Care for belongings',
    meaning: '看到物品背后的资源与劳动，适量使用、妥善维护，在力所能及的时候修复与分享。',
    meaningEn:
      'Recognise the resources and work behind belongings. Use them thoughtfully, maintain them, and repair or share when possible.',
    prompt: '家里有哪件旧物值得修好后继续使用？',
    promptEn: 'Is there an old item at home you could repair and keep using?',
  },
  {
    id: 'integrity',
    term: '清廉',
    english: 'Integrity',
    meaning: '在本篇的日常语境中，指诚实、自律，尊重共同规则，并保持公私之间的清晰边界。',
    meaningEn:
      'In this everyday context, integrity means honesty, self-discipline, respect for shared rules and clear public/private boundaries.',
    prompt: '你会如何与家人讨论一条共同遵守的边界？',
    promptEn: 'How would you discuss a shared boundary with your family?',
  },
  {
    id: 'respect',
    term: '尊重',
    english: 'Respect',
    meaning: '认真看见他人的感受和选择，愿意倾听，并以平等的方式表达不同意见。',
    meaningEn:
      'Notice other people’s feelings and choices, listen carefully, and express disagreement as equals.',
    prompt: '下次意见不同时，你可以先问对方什么？',
    promptEn: 'What could you ask first when you disagree with someone?',
  },
  {
    id: 'discipline',
    term: '自律',
    english: 'Self-discipline',
    meaning: '不只依靠别人的提醒，也主动依据自己的约定与共同规则安排日常行动。',
    meaningEn:
      'Guide daily actions by your own commitments and shared rules rather than relying only on reminders from others.',
    prompt: '哪个小习惯可以帮助你兑现自己的约定？',
    promptEn: 'Which small habit could help you keep a commitment?',
  },
  {
    id: 'family',
    term: '家风',
    english: 'Family values in practice',
    meaning:
      '一个家庭在长期共同生活中体现出的待人方式、做事习惯和价值选择。它可以在平凡小事中被看见。',
    meaningEn:
      'The ways a family treats people, acts and makes choices over time. These values become visible in ordinary moments.',
    prompt: '选一件家中小事，说说它体现了怎样的家风。',
    promptEn: 'Choose a small family moment and describe the value it reflects.',
  },
]
export function glossaryFor(item: ReadingItem) {
  const found = readingGlossary.filter((entry) => (item.title + item.content).includes(entry.term))
  return found.length ? found : readingGlossary.slice(0, 3)
}
