export const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

export type Lesson = { id: number; title: string; body: string; occurred_on: string }
export type Decision = { id: number; body: string; reason: string; decided_on: string }
export type Card = {
  id: number; title: string; done_on: string; category: string; note: string
  record_id: number; cohort_id: number; cohort_name: string; event_name: string; record_title: string
  lessons: Lesson[]; decisions: Decision[]
}
export type DecisionRow = Decision & {
  cohort_id: number; timeline_item_id: number; item_title: string; item_done_on: string
  event_name: string; record_id: number; cohort_name: string
}
export type LastYear = { center: string; window_days: number; notice: string; cards: Card[] }
export type Source = { record_id: number; title: string; quote: string; occurred_on: string }
export type AskResult = { answer: string; sources: Source[] }
export type Cohort = { id: number; name: string; year: number }
export type SeniorRecord = {
  id: number; cohort_id: number; type: string; title: string; body: string; event_name: string; occurred_on: string
  has_pdf?: boolean
}

export class Unauthorized extends Error {}
const KEY = 'access-key'
export const getKey = () => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } }
export const setKey = (k: string) => { try { localStorage.setItem(KEY, k) } catch { /* private mode */ } }
const auth = (): Record<string, string> => (getKey() ? { 'X-Access-Key': getKey() } : {})

export async function fetchPdf(id: number): Promise<string> {
  const res = await fetch(`${BASE}/api/records/${id}/pdf`, { headers: auth() })
  if (res.status === 401) throw new Unauthorized('접근 키가 필요합니다')
  if (!res.ok) throw new Error('원본 문서를 불러오지 못했습니다')
  return URL.createObjectURL(await res.blob())
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, { ...init, headers: { 'Content-Type': 'application/json', ...auth() } })
  if (res.status === 401) throw new Unauthorized('접근 키가 필요합니다')
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.detail ?? `요청에 실패했습니다 (${res.status})`)
  }
  return res.json()
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) })

async function upload(form: FormData) {
  const res = await fetch(BASE + '/api/records/upload', { method: 'POST', body: form, headers: auth() })
  if (res.status === 401) throw new Unauthorized('접근 키가 필요합니다')
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.detail ?? `업로드에 실패했습니다 (${res.status})`)
  return j as { record: SeniorRecord; timeline_items: unknown[]; extraction: string }
}

export const api = {
  upload,
  updateRecord: (id: number, b: Partial<Pick<SeniorRecord, 'title' | 'event_name' | 'occurred_on' | 'body'>>) =>
    call<SeniorRecord>(`/api/records/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteRecord: (id: number) => call<{ deleted: number }>(`/api/records/${id}`, { method: 'DELETE' }),
  decisions: () => call<DecisionRow[]>('/api/decisions'),
  lastYear: (date: string, windowDays = 14) => call<LastYear>(`/api/timeline/last-year?date=${date}&window_days=${windowDays}`),
  ask: (question: string) => post<AskResult>('/api/ask', { question }),
  cohorts: () => call<Cohort[]>('/api/cohorts'),
  records: () => call<SeniorRecord[]>('/api/records'),
  record: (id: number) => call<SeniorRecord>(`/api/records/${id}`),
  addRecord: (b: Omit<SeniorRecord, 'id' | 'has_pdf'>) =>
    post<{ record: SeniorRecord; timeline_items: unknown[]; extraction: string }>('/api/records', b),
  interviewNext: (cohort_id: number, event_name: string) =>
    post<{ question: string | null; done: boolean }>('/api/interviews/next', { cohort_id, event_name }),
  interviewAnswer: (cohort_id: number, event_name: string, question: string, answer: string) =>
    post<SeniorRecord>('/api/interviews/answer', { cohort_id, event_name, question, answer }),
  addDecision: (timeline_item_id: number, body: string, reason: string) =>
    post<Decision>('/api/decisions', { timeline_item_id, body, reason }),
}
