import { Fragment, type ReactNode } from 'react'

// Just enough Markdown for chat replies: paragraphs, "-" bullet lists, **bold**,
// *italic* and `code`. Everything renders as React text, so model output can
// never inject HTML.

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>
    return <Fragment key={i}>{part}</Fragment>
  })
}

export default function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  let para: string[] = []

  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>)
    para = []
  }
  const flushList = () => {
    if (list.length)
      blocks.push(
        <ul key={blocks.length}>
          {list.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>,
      )
    list = []
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (bullet) {
      flushPara()
      list.push(bullet[1])
    } else if (!line) {
      flushPara()
      flushList()
    } else {
      flushList()
      para.push(line.replace(/^#+\s*/, ''))
    }
  }
  flushPara()
  flushList()
  return <div className="md">{blocks}</div>
}
