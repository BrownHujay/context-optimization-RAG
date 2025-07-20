// src/components/MarkdownRenderer.tsx
import React, { useMemo, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
// Import both light and dark highlight.js themes
import 'highlight.js/styles/github.css';
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  // Memoize the components to prevent unnecessary re-renders  
  const memoizedComponents = useMemo(() => ({
    // Custom styling for different elements
    h1: (props: any) => (
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="text-2xl font-bold text-[var(--text-primary)] mb-4 mt-6"
      >
        {props.children}
      </motion.h1>
    ),
    h2: (props: any) => (
      <motion.h2
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="text-xl font-bold text-[var(--text-primary)] mb-3 mt-5"
      >
        {props.children}
      </motion.h2>
    ),
    h3: (props: any) => (
      <motion.h3
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="text-lg font-bold text-[var(--text-primary)] mb-2 mt-4"
      >
        {props.children}
      </motion.h3>
    ),
    h4: (props: any) => (
      <motion.h4
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="text-base font-bold text-[var(--text-primary)] mb-2 mt-3"
      >
        {props.children}
      </motion.h4>
    ),
    h5: (props: any) => (
      <motion.h5
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="text-sm font-bold text-[var(--text-primary)] mb-2 mt-3"
      >
        {props.children}
      </motion.h5>
    ),
    h6: (props: any) => (
      <motion.h6
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="text-xs font-bold text-[var(--text-primary)] mb-2 mt-3"
      >
        {props.children}
      </motion.h6>
    ),
    p: (props: any) => (
      <p className="text-[var(--text-primary)] mb-3 leading-relaxed">
        {props.children}
      </p>
    ),
    code: ({ inline, className, children, ...props }: any) => {
      if (inline) {
        return (
          <code
            className="bg-[var(--inline-code-bg)] text-[var(--code-text)] px-1.5 py-0.5 rounded text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="my-4"
        >
          <div className="bg-[var(--code-bg)] border border-[var(--border-color)] rounded-lg overflow-hidden code-block-wrapper">
            <pre className="p-4 text-sm text-[var(--code-text)] overflow-x-auto">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          </div>
        </motion.div>
      );
    },
    blockquote: (props: any) => (
      <motion.blockquote
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="border-l-4 border-[var(--theme-color)] pl-4 py-2 my-4 bg-[var(--blockquote-bg)] text-[var(--text-secondary)] italic"
      >
        {props.children}
      </motion.blockquote>
    ),
    ul: (props: any) => (
      <ul className="list-disc list-inside mb-4 text-[var(--text-primary)] space-y-1">
        {props.children}
      </ul>
    ),
    ol: (props: any) => (
      <ol className="list-decimal list-inside mb-4 text-[var(--text-primary)] space-y-1">
        {props.children}
      </ol>
    ),
    li: (props: any) => (
      <motion.li
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="text-[var(--text-primary)]"
      >
        {props.children}
      </motion.li>
    ),
    a: ({ href, children, ...props }: any) => (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--theme-color)] underline hover:text-[var(--theme-color-dark)] transition-colors duration-200"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        {...props}
      >
        {children}
      </motion.a>
    ),
    strong: (props: any) => (
      <strong className="font-bold text-[var(--text-primary)]">
        {props.children}
      </strong>
    ),
    em: (props: any) => (
      <em className="italic text-[var(--text-primary)]">
        {props.children}
      </em>
    ),
    hr: () => (
      <motion.hr
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.5 }}
        className="border-t border-[var(--border-color)] my-6"
      />
    ),
    table: (props: any) => (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="overflow-x-auto my-4"
      >
        <table className="min-w-full border border-[var(--border-color)] rounded-lg">
          {props.children}
        </table>
      </motion.div>
    ),
    thead: (props: any) => (
      <thead className="bg-[var(--code-header-bg)]">
        {props.children}
      </thead>
    ),
    th: (props: any) => (
      <th className="px-4 py-2 text-left text-[var(--text-primary)] font-semibold border-b border-[var(--border-color)]">
        {props.children}
      </th>
    ),
    td: (props: any) => (
      <td className="px-4 py-2 text-[var(--text-primary)] border-b border-[var(--border-color)]">
        {props.children}
      </td>
    ),
  }), []);

  // Apply theme-aware styles to highlight.js after render
  useLayoutEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    const codeBlocks = document.querySelectorAll('.code-block-wrapper pre code');
    
    codeBlocks.forEach((block) => {
      if (isDark) {
        block.classList.remove('hljs-light');
        block.classList.add('hljs-dark');
      } else {
        block.classList.remove('hljs-dark');
        block.classList.add('hljs-light');
      }
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`markdown-content ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={memoizedComponents}
      >
        {content}
      </ReactMarkdown>
    </motion.div>
  );
};

export default MarkdownRenderer;
