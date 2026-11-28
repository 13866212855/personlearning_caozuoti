import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '高中会考实操练习与测评系统',
  description:
    '面向普通高中学业水平考试（信息技术、通用技术）的操作题智能练习、交互仿真操作环境与自动评分平台。',
  openGraph: {
    title: '高中会考实操练习与测评系统',
    description:
      '面向普通高中学业水平考试（信息技术、通用技术）的操作题智能练习、交互仿真操作环境与自动评分平台。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '高中会考实操练习与测评系统',
    description:
      '面向普通高中学业水平考试（信息技术、通用技术）的操作题智能练习、交互仿真操作环境与自动评分平台。',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning className="min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
