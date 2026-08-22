"use client";

export default function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">
          Deluxe AI Assistant
        </h1>

        <p className="text-sm text-gray-500">Enterprise AI Sales Assistant</p>
      </div>

      <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100">
        New Chat
      </button>
    </header>
  );
}
