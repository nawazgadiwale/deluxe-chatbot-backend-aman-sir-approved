import "./globals.css";

export const metadata = {
  title: "Deluxe AI Assistant",
  description: "Enterprise AI Sales Assistant",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 antialiased">{children}</body>
    </html>
  );
}
