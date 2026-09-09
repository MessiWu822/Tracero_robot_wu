import { useEffect, useState } from 'react'
import type { CodeLanguage } from '../mock-data'

type CodeHighlighter = {
  codeToHtml: (
    code: string,
    options: { lang: 'cpp' | 'yaml'; theme: string }
  ) => string
}

let highlighterPromise: Promise<CodeHighlighter> | undefined

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('shiki/langs/cpp.mjs'),
      import('shiki/langs/yaml.mjs'),
      import('shiki/themes/github-dark-default.mjs'),
    ]).then(
      async ([
        { createHighlighterCore },
        { createJavaScriptRegexEngine },
        cpp,
        yaml,
        githubDarkDefault,
      ]) =>
        createHighlighterCore({
          themes: [githubDarkDefault.default],
          langs: [cpp.default, yaml.default],
          engine: createJavaScriptRegexEngine(),
        }) as Promise<CodeHighlighter>
    )
  }

  return highlighterPromise
}

type ShikiCodeProps = {
  code: string
  language: CodeLanguage
  lineStart: number
  highlightLines: number[]
}

function addLineMetadata(
  html: string,
  lineStart: number,
  highlightLines: number[]
) {
  let lineNumber = lineStart - 1

  return html.replace(/<span class="line">/g, () => {
    lineNumber += 1
    const highlighted = highlightLines.includes(lineNumber)

    return `<span class="line${highlighted ? ' highlighted' : ''}" data-line="${lineNumber}"><span class="line-number">${lineNumber}</span>`
  })
}

export function ShikiCode({
  code,
  language,
  lineStart,
  highlightLines,
}: ShikiCodeProps) {
  const renderKey = `${language}:${lineStart}:${highlightLines.join(',')}:${code}`
  const [renderedCode, setRenderedCode] = useState({
    key: '',
    html: '',
  })

  useEffect(() => {
    let cancelled = false

    async function renderCode() {
      if (language === 'log') {
        if (!cancelled) setRenderedCode({ key: renderKey, html: '' })
        return
      }

      const highlighter = await getHighlighter()
      const rendered = highlighter.codeToHtml(code, {
        lang: language,
        theme: 'github-dark-default',
      })

      if (!cancelled) {
        setRenderedCode({
          key: renderKey,
          html: addLineMetadata(rendered, lineStart, highlightLines),
        })
      }
    }

    void renderCode()

    return () => {
      cancelled = true
    }
  }, [code, highlightLines, language, lineStart, renderKey])

  if (language === 'log') {
    return (
      <pre className='min-w-max p-4 font-mono text-xs leading-6 text-slate-300'>
        {code.split('\n').map((line, index) => {
          const lineNumber = lineStart + index
          const highlighted = highlightLines.includes(lineNumber)

          return (
            <span
              key={lineNumber}
              className={`block min-w-max pr-4 ${
                highlighted
                  ? 'bg-amber-300/12 shadow-[inset_3px_0_0_rgba(251,191,36,0.8)]'
                  : ''
              }`}
            >
              <span className='mr-4 inline-block w-[3.25rem] border-r border-white/10 pr-3 text-right text-slate-500 select-none'>
                {lineNumber}
              </span>
              <span>{line || ' '}</span>
            </span>
          )
        })}
      </pre>
    )
  }

  if (renderedCode.key !== renderKey) {
    return (
      <div
        className='min-w-max p-4 font-mono text-xs leading-6 [tab-size:2]'
        aria-label='正在加载代码高亮'
      >
        {code.split('\n').map((_, index) => {
          const lineNumber = lineStart + index

          return (
            <div
              key={lineNumber}
              className='flex h-6 min-w-max items-center pr-4'
            >
              <span className='mr-4 inline-block w-[3.25rem] shrink-0 border-r border-white/10 pr-3 text-right text-slate-600 select-none'>
                {lineNumber}
              </span>
              <span
                className='h-3 rounded-sm bg-slate-800'
                style={{ width: `${Math.min(18 + (index % 4) * 7, 42)}rem` }}
              />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className={[
        'min-w-max font-mono text-xs leading-6 [tab-size:2]',
        '[&_pre]:m-0 [&_pre]:min-w-max [&_pre]:overflow-visible [&_pre]:bg-transparent! [&_pre]:p-4',
        '[&_code]:block [&_code]:min-w-max',
        '[&_.line]:block [&_.line]:min-h-6 [&_.line]:min-w-max [&_.line]:pr-4 [&_.line]:whitespace-pre',
        '[&_.line-number]:mr-4 [&_.line-number]:inline-block [&_.line-number]:w-[3.25rem]',
        '[&_.line-number]:border-r [&_.line-number]:border-white/10 [&_.line-number]:pr-3',
        '[&_.line-number]:text-right [&_.line-number]:text-slate-500 [&_.line-number]:select-none',
        '[&_.highlighted]:bg-amber-300/12 [&_.highlighted]:shadow-[inset_3px_0_0_rgba(251,191,36,0.8)]',
      ].join(' ')}
      dangerouslySetInnerHTML={{ __html: renderedCode.html }}
    />
  )
}
