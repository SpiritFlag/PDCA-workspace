// Design Ref: §5.5 — PDCA 배지 색상: plan=blue, design=lavender, analysis=peach, report=green
// design은 원래 mauve였으나, 주 강조색 mauve를 여름 틸로 바꾸면서 plan(blue)과 겹치지 않도록 lavender로 분리.
export const STAGE_COLOR: Record<'plan' | 'design' | 'analysis' | 'report', string> = {
  plan: 'var(--ctp-blue)',
  design: 'var(--ctp-lavender)',
  analysis: 'var(--ctp-peach)',
  report: 'var(--ctp-green)',
}
