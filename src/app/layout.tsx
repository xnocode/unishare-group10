import type { Metadata } from "next";
import { DM_Sans, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UniShare — Your campus, one big shared shelf",
  description:
    "Rent cameras, calculators, laptops and more from students of your own university. Verified with your university email, never open to outsiders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${bricolageGrotesque.variable} h-full antialiased`}
    >
      <body className={`${dmSans.className} min-h-full flex flex-col bg-white text-[#12201f]`}>
        {children}
      </body>
    </html>
  );
}
