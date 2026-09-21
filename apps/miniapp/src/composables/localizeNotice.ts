import { locale } from './useLocale'
const messages: Record<string, string> = {
  '未找到演示作品。': 'This sample submission was not found.',
  '仅本人被退回的作品可以修改重投。':
    'Only your returned submissions can be revised and resubmitted.',
  '未找到这个演示活动，请返回活动列表重试。':
    'This sample event was not found. Return to the event list.',
  '草稿格式不正确，请检查体裁、通道和地区。':
    'The draft format is invalid. Check genre, channel and region.',
  '请选择有效的评审操作。': 'Choose a valid review action.',
  '每项评分须为0–100之间的数字。': 'Each score must be a number from 0 to 100.',
  '请填写5–1000字的评审意见。': 'Enter review feedback between 5 and 1,000 characters.',
  '该作品当前不能继续评审。': 'This submission cannot be reviewed in its current state.',
  '仅审核中的作品可以退回修改。': 'Only submissions under review can be returned.',
  '该作品已完成层级评审。': 'All review stages have already been completed.',
  '完成前五级评审后方可确认入围。':
    'Complete the first five stages before confirming the shortlist.',
  '只有入围作品可以模拟授奖。': 'Only shortlisted submissions can receive a sample award.',
  '只有已获奖作品可以模拟入藏。': 'Only awarded submissions can enter the sample collection.',
  '未找到这条演示消息。': 'This sample notification was not found.',
  '未找到可收藏的演示内容。': 'This sample content is no longer available to save.',
  '该演示活动名额已满。': 'This sample event is full.',
  已取消演示预约: 'Sample booking cancelled.',
  '演示预约成功，可在个人中心查看': 'Sample booking saved. View it in your account.',
  '字号已调整，但本机设置未能保存': 'Text size changed, but the preference could not be saved.',
  '地区已切换，但本机设置未能保存': 'Region changed, but the preference could not be saved.',
  '操作未完成，请重试': 'The action was not completed. Please try again.',
  '本机存储不可用，请检查权限后刷新。':
    'Device storage is unavailable. Check permissions and reload.',
  '本机存储不可用，当前仅可浏览演示内容；草稿、投稿、收藏与预约无法保存。请检查设备存储权限后刷新。':
    'Device storage is unavailable. You can browse samples, but drafts, submissions, saved items and bookings cannot be saved. Check storage permissions and reload.',
  '标题需为 2–50 个字。': 'Enter a title between 2 and 50 characters.',
  '正文至少填写 20 个字。': 'Write at least 20 characters.',
  '正文最多填写 10000 个字。': 'The text must not exceed 10,000 characters.',
  '请选择有效的投稿体裁。': 'Choose a valid genre.',
  '请选择有效的投稿通道。': 'Choose a valid submission channel.',
  '请选择有效的所属地区。': 'Choose a valid region.',
  '请阅读并同意演示版权声明。': 'Read and accept the demonstration copyright notice.',
  '请选择最多3个不重复的有效主题。': 'Choose up to three distinct valid themes.',
  '附件最多5个，单个不超过10MB，仅支持图片、PDF和Word元数据。':
    'Choose up to five images, PDF or Word files, no larger than 10 MB each.',
  '请填写不超过100字的海外国家与城市。':
    'Enter the overseas country and city in up to 100 characters.',
  '正文格式与文字不一致，请重新确认正文。':
    'Formatting and text do not match. Confirm the text again.',
}
export function localizeNotice(message: string) {
  return locale.value === 'en' ? (messages[message] ?? message) : message
}
