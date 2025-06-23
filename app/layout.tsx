import type { Metadata } from "next";
import { Concert_One } from "next/font/google";
import "./globals.css";

const concert = Concert_One({
  variable: "--font-concert",
  subsets: ["latin"],
  weight: ["400"],
});


export const metadata: Metadata = {
  title: "Language Flashcards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${concert.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
