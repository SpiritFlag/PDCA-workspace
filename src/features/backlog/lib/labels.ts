// Design Ref: §5.2 배지 규약 — enum(영문) ↔ 화면 라벨(한글)·색상 매핑 단일 원천 (§10)
import type { BacklogStatus } from '@shared/transition'
import type { BacklogPriority } from '@shared/schema'

export const PRIORITY_LABEL: Record<BacklogPriority, string> = {
  urgent: '긴급',
  high: '높음',
  medium: '중간',
  low: '낮음',
}

export const PRIORITY_COLOR: Record<BacklogPriority, string> = {
  urgent: 'var(--ctp-red)',
  high: 'var(--ctp-peach)',
  medium: 'var(--ctp-yellow)',
  low: 'var(--ctp-overlay1)',
}

export const PRIORITY_ORDER: BacklogPriority[] = ['urgent', 'high', 'medium', 'low']

export const STATUS_LABEL: Record<BacklogStatus, string> = {
  todo: '대기',
  doing: '진행',
  done: '완료',
  resolved: '해소',
  dropped: '삭제',
}

export const STATUS_COLOR: Record<BacklogStatus, string> = {
  todo: 'var(--ctp-blue)',
  doing: 'var(--ctp-mauve)',
  done: 'var(--ctp-green)',
  resolved: 'var(--ctp-teal)',
  dropped: 'var(--ctp-overlay0)',
}

export const STATUS_ORDER: BacklogStatus[] = ['todo', 'doing', 'done', 'resolved', 'dropped']
