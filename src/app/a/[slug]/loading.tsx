// Shown at once when a page in the account is opened, while its data loads,
// so a click in the menu is answered right away. The menu itself stays.
function Bar({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded-md bg-line ${className}`} />;
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Bar className="h-7 w-56" />
        <Bar className="h-4 w-80 max-w-full" />
      </div>
      <div className="card flex flex-col gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Bar className="h-4 w-1/3" />
            <Bar className="h-4 w-1/4" />
            <Bar className="h-4 w-1/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
