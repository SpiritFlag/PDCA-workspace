// Design Ref: §8.2 t1~t2
import { describe, expect, it } from 'vitest'
import { releaseUrl } from './releaseUrl'

describe('releaseUrl', () => {
  it('t1: 워크스페이스·프로젝트·버전 슬러그를 /r/ 경로로 조립한다', () => {
    expect(releaseUrl('hobby', 'pdca-workspace', 'v0.1.7')).toBe(
      '/w/hobby/p/pdca-workspace/r/v0.1.7',
    )
  })

  it('t2: 버전 문자열은 인코딩 없이 그대로 들어간다(cycleVersionSchema가 문자셋을 보증)', () => {
    expect(releaseUrl('ws', 'proj', 'v10.20.30')).toBe('/w/ws/p/proj/r/v10.20.30')
  })
})
