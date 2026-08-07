// Design Ref: §5.5 — PDCA 배지 색상: plan=blue, design=mauve, analysis=peach, report=green
export const STAGE_COLOR: Record<'plan' | 'design' | 'analysis' | 'report', string> = {
  plan: 'var(--ctp-blue)',
  design: 'var(--ctp-mauve)',
  analysis: 'var(--ctp-peach)',
  report: 'var(--ctp-green)',
}
