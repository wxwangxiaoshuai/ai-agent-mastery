import { useState, useEffect } from 'react'
import { MarkdownRenderer } from '../components/MarkdownRenderer'

export function FAQPage() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('../content/faq.md?raw')
      .then((m) => {
        setContent((m as { default: string }).default || '')
        setLoading(false)
      })
      .catch(() => {
        setContent('FAQ 内容加载失败。')
        setLoading(false)
      })
  }, [])

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="section-eyebrow">踩坑记录</span>
        <h1 className="section-title">常见问题与 FAQ</h1>
        <p className="mt-4 text-ink-400">
          AI Agent 开发中最常遇到的错误和疑问，按模块分类。
          每个条目都是真实踩过的坑，建议在学完对应模块后浏览一遍。
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-3/4 rounded bg-ink-800" />
            <div className="h-4 w-1/2 rounded bg-ink-800" />
            <div className="h-4 w-2/3 rounded bg-ink-800" />
          </div>
        ) : (
          <MarkdownRenderer content={content} />
        )}
      </div>
    </div>
  )
}