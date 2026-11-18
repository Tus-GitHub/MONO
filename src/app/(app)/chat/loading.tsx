export default function ChatLoading() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-elevated px-4 py-3">
        <div className="skeleton size-9 rounded-full" />
        <div className="space-y-1.5">
          <div className="skeleton h-4 w-28 rounded-md" />
          <div className="skeleton h-3 w-36 rounded-md" />
        </div>
      </div>
      <div className="flex-1 space-y-3 p-4">
        <div className="skeleton ml-auto h-12 w-48 rounded-2xl" />
        <div className="skeleton h-12 w-56 rounded-2xl" />
        <div className="skeleton ml-auto h-10 w-40 rounded-2xl" />
      </div>
    </div>
  );
}
