import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '動態減脂拉鋸戰助手',
  description: 'Dynamic Fat Loss Companion - 10天動態營養素調整減脂計畫',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}