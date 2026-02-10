export const metadata = {
  title: "Offline - War Room",
};

export default function OfflinePage() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#050505]">
      <div className="text-center">
        <div className="mb-6 animate-pulse text-4xl text-[#10b981]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto"
          >
            <path d="M12 6V2" />
            <path d="m4.93 10.93 2.83 2.83" />
            <path d="M2 18h4" />
            <path d="M20 18h-4" />
            <path d="m19.07 10.93-2.83 2.83" />
            <path d="M22 22H2" />
            <path d="m9 22 3-8 3 8" />
          </svg>
        </div>
        <h1 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-xl font-medium tracking-tight text-[#E5E5E5]">
          Reconnecting to War Room...
        </h1>
        <p className="text-sm text-[rgba(255,255,255,0.4)]">
          Waiting for network connection
        </p>
      </div>
    </div>
  );
}
