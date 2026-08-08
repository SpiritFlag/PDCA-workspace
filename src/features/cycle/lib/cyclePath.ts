// 사이클↔문서 경로 규칙 단일 원천: docs/PDCA/{yearMonth}/{name}/{name}.{stage}.md
export type PdcaStage = 'plan' | 'design' | 'analysis' | 'report'
export const PDCA_STAGES: PdcaStage[] = ['plan', 'design', 'analysis', 'report']

export function cycleStagePath(yearMonth: string, name: string, stage: PdcaStage): string {
  return `docs/PDCA/${yearMonth}/${name}/${name}.${stage}.md`
}
