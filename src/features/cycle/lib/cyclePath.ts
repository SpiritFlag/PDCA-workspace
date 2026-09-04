// 사이클↔문서 경로 규칙 단일 원천 (pdca-skill v1).
// 서버는 경로를 계산하지 않고 사이클 폴더(dir)를 기록한다. 문서 경로는 폴더명 == 파일 어간 규칙 하나:
//   {dir}/{basename(dir)}.{stage}.md
// 옛 배치(docs/PDCA/2026-08/name)도 새 배치(docs/PDCA/v1/v1.2.0-name)도 같은 식으로 조립된다.
import type { PdcaStage } from '@shared/schema'

export type { PdcaStage }
export const PDCA_STAGES: PdcaStage[] = ['plan', 'design', 'do', 'analysis', 'report', 'release']

export function cycleStagePath(dir: string, stage: PdcaStage): string {
  const stem = dir.split('/').pop() ?? dir
  return `${dir}/${stem}.${stage}.md`
}
