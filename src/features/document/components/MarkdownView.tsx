// Design Ref: §2.2 데이터 흐름 — react-markdown 구성 + 링크 컴포넌트 오버라이드 주입.
// Decision: [Do] rehype-raw 미사용 — cogmo-report 67개 문서 전수조사 결과 실제 raw HTML 0건(배치 2).
// react-markdown은 rehype-raw 없이는 마크다운 속 <script> 등을 파싱하지 않고 그냥 이스케이프된 텍스트로 렌더한다
// (Plan SC: C7 — 이 구성 자체가 XSS 방어. rehype-sanitize는 방어 심층화용으로 유지).
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { SmartLink } from './SmartLink'

export function MarkdownView({
  content,
  currentPath,
  wsSlug,
  projSlug,
  existingPaths,
}: {
  content: string
  currentPath: string
  wsSlug: string
  projSlug: string
  existingPaths: Set<string>
}) {
  return (
    <div className="prose-doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children }) => (
            <SmartLink
              href={href}
              currentPath={currentPath}
              wsSlug={wsSlug}
              projSlug={projSlug}
              existingPaths={existingPaths}
            >
              {children}
            </SmartLink>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
