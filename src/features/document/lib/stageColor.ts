// PDCA 배지 색상(6 stage). plan=blue, design=lavender, do=teal, analysis=peach, report=green, release=yellow.
// design은 원래 mauve였으나 주 강조색 mauve와 겹치지 않도록 lavender로 분리했다.
import type { PdcaStage } from '@shared/schema'

export const STAGE_COLOR: Record<PdcaStage, string> = {
  plan: 'var(--ctp-blue)',
  design: 'var(--ctp-lavender)',
  do: 'var(--ctp-teal)',
  analysis: 'var(--ctp-peach)',
  report: 'var(--ctp-green)',
  release: 'var(--ctp-yellow)',
}
