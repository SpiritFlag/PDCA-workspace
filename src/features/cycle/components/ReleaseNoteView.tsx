// 릴리즈 노트 전용 경량 마크다운 렌더러. 문서 링크 해석(SmartLink)이 필요 없어 MarkdownView와 분리.
// XSS 방어: react-markdown 기본(raw HTML 미파싱) + rehype-sanitize 심층화 (MarkdownView와 동일 방침).
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

export function ReleaseNoteView({ content }: { content: string }) {
  return (
    <div className="prose-doc">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
