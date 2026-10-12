import { Html, Head, Main, NextScript } from 'next/document';
export default function Document() {
  return <Html><Head>{process.env.NEXT_PUBLIC_VSUB_WEB && <script src="/app/com.ictrek.v-sub/web-bridge.js" />}</Head><body><Main /><NextScript /></body></Html>;
}
