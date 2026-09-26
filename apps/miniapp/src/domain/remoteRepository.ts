import {
  remoteWorkspace,
  remoteDraft,
  command,
  saveRemoteDraft,
  clearRemoteDraft,
  submitRemote,
} from '../services/api'
import { validateSubmission, SubmissionValidationError } from './repository'
import type { RegionFilter, WorkFilter, SubmissionDraft, Work, ReviewInput } from './types'

const inRegion = (item: { region: string }, filter: RegionFilter) =>
  !filter.region ||
  filter.region === 'all' ||
  item.region === filter.region ||
  item.region === 'all'
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export function createRemoteRepository() {
  const allWorks = () => remoteWorkspace.works
  const findWork = (id: string) => allWorks().find((item) => item.id === id)
  return {
    listWorks: (filter: WorkFilter = {}) =>
      allWorks().filter(
        (item) =>
          inRegion(item, filter) &&
          (!filter.genre || item.genre === filter.genre) &&
          (!filter.channel || item.channel === filter.channel),
      ),
    listMyWorks: () => allWorks().filter((item) => item.isMine),
    getWork: findWork,
    listClassics: (filter: RegionFilter = {}) =>
      remoteWorkspace.classics.filter((item) => inRegion(item, filter)),
    getClassic: (id: string) => remoteWorkspace.classics.find((item) => item.id === id),
    listActivities: (filter: RegionFilter = {}) =>
      remoteWorkspace.activities.filter((item) => inRegion(item, filter)),
    getDraft: () => remoteDraft.value,
    saveDraft: saveRemoteDraft,
    clearDraft: clearRemoteDraft,
    validateSubmission(draft: SubmissionDraft) {
      const errors = validateSubmission(draft)
      if (draft.region === 'all') errors.region = '请选择实际投稿地区。全国仅用于浏览筛选。'
      return errors
    },
    async submitWork(draft: SubmissionDraft) {
      const errors = this.validateSubmission(draft)
      if (Object.keys(errors).length) throw new SubmissionValidationError(errors)
      return submitRemote(draft)
    },
    async resubmitWork(id: string, draft: SubmissionDraft) {
      return this.submitWork({ ...draft, editingWorkId: id })
    },
    async prepareRevision(id: string) {
      const work = findWork(id)
      if (!work || !work.isMine || work.status !== 'returned')
        throw new Error('仅本人退回稿件可以修改重投。')
      const draft: SubmissionDraft = {
        title: work.title,
        content: work.content,
        contentDelta: work.contentDelta,
        author: work.author,
        genre: work.genre,
        channel: work.channel,
        region: work.region,
        themes: work.themes || [],
        attachments: work.attachments || [],
        overseasLocation: work.overseasLocation,
        copyrightAccepted: false,
        editingWorkId: id,
      }
      return saveRemoteDraft(copy(draft))
    },
    listReviewTasks: (filter: RegionFilter = {}) =>
      allWorks().filter((item) => inRegion(item, filter)),
    listPublicWorks: (status?: 'shortlisted' | 'awarded' | 'collected') =>
      allWorks().filter(
        (item) =>
          item.published === true &&
          (status
            ? item.status === status
            : ['shortlisted', 'awarded', 'collected'].includes(item.status)),
      ),
    async reviewWork(_id: string, _input: ReviewInput): Promise<Work> {
      throw new Error('真实评审请使用分配给您的四维评审任务。')
    },
    listNotifications: () => remoteWorkspace.notifications,
    markNotificationRead: (id: string) => command('notification.read', id),
    listCertificates: () => remoteWorkspace.certificates,
    getCertificate: (workId: string) =>
      remoteWorkspace.certificates.find((item) => item.workId === workId),
    listFavorites: () =>
      [...allWorks(), ...remoteWorkspace.classics].filter((item) =>
        remoteWorkspace.favorites.includes(item.id),
      ),
    isFavorite: (id: string) => remoteWorkspace.favorites.includes(id),
    toggleFavorite: (id: string) => command('favorite.toggle', id),
    isRegistered: (id: string) =>
      remoteWorkspace.registrations.some((item) => item.activityId === id),
    listRegistrations: () => remoteWorkspace.registrations,
    registerActivity: (id: string) => command('activity.register', id),
    cancelRegistration: (id: string) => command('activity.cancel', id),
  }
}
