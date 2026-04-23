import { request } from './client.js'
import { ENDPOINTS } from './endpoints.js'
import { ApiError } from '../lib/apiError.js'
import { getStoredUser } from '../lib/tokenStorage.js'

const POLL_VOTES_KEY = 'survey_app_poll_votes_v1'
const GUEST_VOTER_KEY = 'survey_app_guest_voter_v1'

function shouldUseLocalFallback(error) {
  return error instanceof TypeError || (error instanceof ApiError && [404, 405, 501].includes(error.status))
}

function normalizeIdentity(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim().toLowerCase()
}

function readText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function getUserIdentity(user = getStoredUser()) {
  if (!user || typeof user !== 'object') {
    return ''
  }

  const id = normalizeIdentity(user.id ?? user.userId ?? user.sub ?? user.nameid)
  const email = normalizeIdentity(user.email ?? user.Email)
  return id || email
}

function getGuestIdentity() {
  const stored = normalizeIdentity(localStorage.getItem(GUEST_VOTER_KEY))
  if (stored) {
    return stored
  }

  const generated = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  localStorage.setItem(GUEST_VOTER_KEY, generated)
  return generated
}

function getResponderKey(user = getStoredUser(), { allowGuest = false } = {}) {
  const userIdentity = getUserIdentity(user)
  if (userIdentity) {
    return `user:${userIdentity}`
  }

  if (!allowGuest) {
    return ''
  }

  return `guest:${getGuestIdentity()}`
}

function loadVoteStore() {
  try {
    const raw = localStorage.getItem(POLL_VOTES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveVoteStore(items) {
  localStorage.setItem(POLL_VOTES_KEY, JSON.stringify(items))
}

function matchesQuestion(answer, question) {
  const answerId = readText(answer?.questionId)
  const questionId = readText(question?.id)
  const answerText = readText(answer?.questionText)
  const questionText = readText(question?.text)

  if (answerId && questionId) {
    return answerId === questionId
  }

  if (answerText && questionText) {
    return answerText === questionText
  }

  return false
}

function normalizeSavedAnswer(answer) {
  return {
    questionId: readText(answer?.questionId),
    questionText: readText(answer?.questionText),
    type: readText(answer?.type) === 'choice' ? 'choice' : 'text',
    answer: readText(answer?.answer),
    selectedOption: readText(answer?.selectedOption),
  }
}

function normalizeSavedSubmission(submission) {
  return {
    surveyId: readText(submission?.surveyId),
    responderKey: readText(submission?.responderKey),
    responderName: readText(submission?.responderName),
    responderEmail: readText(submission?.responderEmail),
    submittedAt: submission?.submittedAt || new Date().toISOString(),
    answers: Array.isArray(submission?.answers) ? submission.answers.map(normalizeSavedAnswer) : [],
  }
}

function rememberVoteSubmission(surveyId, payload, user = getStoredUser()) {
  const responderKey = readText(payload?.responderKey) || getResponderKey(user, { allowGuest: true })
  if (!responderKey) {
    return
  }

  const surveyKey = readText(surveyId)
  if (!surveyKey) {
    return
  }

  const currentUser = user && typeof user === 'object' ? user : {}
  const submission = normalizeSavedSubmission({
    surveyId: surveyKey,
    responderKey,
    responderName: readText(payload?.responderName ?? currentUser.name ?? currentUser.userName ?? currentUser.email),
    responderEmail: readText(payload?.responderEmail ?? currentUser.email ?? currentUser.Email),
    submittedAt: payload?.submittedAt || new Date().toISOString(),
    answers: payload?.answers,
  })

  const stored = loadVoteStore().filter(
    (item) => !(readText(item?.surveyId) === surveyKey && readText(item?.responderKey) === responderKey),
  )

  stored.push(submission)
  saveVoteStore(stored)
}

function normalizeStatsAnswer(answer) {
  return {
    text: readText(answer?.text ?? answer?.answer),
    responder: readText(answer?.responder) || 'Пользователь',
    submittedAt: answer?.submittedAt || null,
  }
}

function normalizeServerStats(payload, poll) {
  const questions = Array.isArray(payload?.questions) ? payload.questions : []
  const pollQuestions = Array.isArray(poll?.questions) ? poll.questions : []

  const normalizedQuestions = questions.map((question, index) => {
    const fallbackQuestion = pollQuestions[index] || {}
    const questionType = readText(question?.type || fallbackQuestion?.type) === 'choice' ? 'choice' : 'text'

    const optionStats = Array.isArray(question?.optionStats)
      ? question.optionStats.map((option) => ({
        text: readText(option?.text),
        count: Number(option?.count || 0),
        percent: Number(option?.percent || 0),
      }))
      : []

    return {
      key: readText(question?.key) || readText(fallbackQuestion?.id) || `question_${index + 1}`,
      text: readText(question?.text) || readText(fallbackQuestion?.text) || `Вопрос ${index + 1}`,
      type: questionType,
      totalAnswers: Number(question?.totalAnswers || 0),
      optionStats,
      customAnswers: Array.isArray(question?.customAnswers) ? question.customAnswers.map(normalizeStatsAnswer) : [],
      textAnswers: Array.isArray(question?.textAnswers) ? question.textAnswers.map(normalizeStatsAnswer) : [],
    }
  })

  return {
    totalResponses: Number(payload?.totalResponses || 0),
    questions: normalizedQuestions,
  }
}

export function hasUserCompletedPoll(pollId, user = getStoredUser()) {
  const responderKey = getResponderKey(user)
  if (!responderKey) {
    return false
  }

  const surveyKey = readText(pollId)
  return loadVoteStore().some(
    (item) => readText(item?.surveyId) === surveyKey && readText(item?.responderKey) === responderKey,
  )
}

export function getPollStats(poll) {
  const questions = Array.isArray(poll?.questions) ? poll.questions : []
  const surveyKey = readText(poll?.id)
  const submissions = loadVoteStore()
    .map(normalizeSavedSubmission)
    .filter((item) => item.surveyId === surveyKey)

  const questionStats = questions.map((question, index) => {
    const answers = submissions
      .map((submission) => {
        const matched = submission.answers.find((answer) => matchesQuestion(answer, question))
        return matched
          ? {
            ...matched,
            responderName: submission.responderName,
            responderEmail: submission.responderEmail,
            submittedAt: submission.submittedAt,
          }
          : null
      })
      .filter(Boolean)

    if (question.type === 'choice') {
      const options = Array.isArray(question.options) ? question.options : []
      const optionStats = options.map((option) => {
        const optionText = readText(option?.text)
        const count = answers.filter((answer) => {
          const selectedOption = normalizeIdentity(answer.selectedOption)
          const answerText = normalizeIdentity(answer.answer)
          const normalizedOptionText = normalizeIdentity(optionText)

          return selectedOption === normalizedOptionText || answerText === normalizedOptionText
        }).length

        return {
          text: optionText,
          count,
          percent: answers.length ? Math.round((count / answers.length) * 100) : 0,
        }
      })

      const customAnswers = answers
        .filter((answer) => {
          const normalizedAnswer = normalizeIdentity(answer.answer)
          return normalizedAnswer && !optionStats.some((option) => normalizeIdentity(option.text) === normalizedAnswer)
        })
        .map((answer) => ({
          text: answer.answer,
          responder: answer.responderName || answer.responderEmail || 'Пользователь',
          submittedAt: answer.submittedAt,
        }))

      return {
        key: readText(question.id) || `question_${index + 1}`,
        text: readText(question.text),
        type: 'choice',
        totalAnswers: answers.length,
        optionStats,
        customAnswers,
      }
    }

    return {
      key: readText(question.id) || `question_${index + 1}`,
      text: readText(question.text),
      type: 'text',
      totalAnswers: answers.length,
      textAnswers: answers
        .filter((answer) => readText(answer.answer))
        .map((answer) => ({
          text: answer.answer,
          responder: answer.responderName || answer.responderEmail || 'Пользователь',
          submittedAt: answer.submittedAt,
        })),
    }
  })

  return {
    totalResponses: submissions.length,
    questions: questionStats,
  }
}

export async function loadPollStats(poll) {
  if (!poll?.id) {
    return getPollStats(poll)
  }

  try {
    const payload = await request(ENDPOINTS.voteStats(poll.id), {
      auth: false,
    })

    return normalizeServerStats(payload, poll)
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    return getPollStats(poll)
  }
}

export async function submitPollVote(surveyId, payload) {
  const currentUser = getStoredUser()
  const responderKey = getResponderKey(currentUser, { allowGuest: true })

  const enrichedPayload = {
    ...payload,
    surveyId,
    responderKey,
    responderName: readText(currentUser?.name ?? currentUser?.userName ?? currentUser?.email),
    responderEmail: readText(currentUser?.email ?? currentUser?.Email),
    submittedAt: payload?.submittedAt || new Date().toISOString(),
  }

  let response

  try {
    response = await request(ENDPOINTS.voteSubmit(surveyId), {
      method: 'POST',
      auth: false,
      body: enrichedPayload,
    })
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error
    }

    response = {
      success: true,
      local: true,
      message: 'Ответ сохранен локально',
    }
  }

  rememberVoteSubmission(surveyId, enrichedPayload, currentUser)
  return response
}
