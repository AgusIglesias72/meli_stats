import { Inter } from 'next/font/google';
import localFont from 'next/font/local';

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const bdoGrotesk = localFont({
  src: [
    {
      path: '../fonts/BDOGrotesk-Light.woff',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../fonts/BDOGrotesk-Regular.woff',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/BDOGrotesk-Medium.woff',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/BDOGrotesk-DemiBold.woff',
      weight: '600',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-bdo-grotesk',
});
