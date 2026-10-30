export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-3xl font-bold text-gray-900">
          Rep<span className="text-indigo-600">Rx</span>
        </p>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-lg font-semibold text-gray-900">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
