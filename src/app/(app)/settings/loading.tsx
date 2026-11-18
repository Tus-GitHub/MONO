export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-8 w-36 rounded-lg" />
        <div className="skeleton h-4 w-64 rounded-md" />
      </div>

      <div className="space-y-3">
        <div className="skeleton h-6 w-28 rounded-md" />
        <div className="skeleton h-52 w-full rounded-xl" />
      </div>

      <div className="space-y-3">
        <div className="skeleton h-6 w-32 rounded-md" />
        <div className="skeleton h-36 w-full rounded-xl" />
      </div>
    </div>
  );
}
