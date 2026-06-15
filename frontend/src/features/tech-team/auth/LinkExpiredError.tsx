export function LinkExpiredError() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md text-center rounded-xl bg-surface border border-outline-variant p-8 shadow-sm">
        <h2 className="text-headline-lg font-headline-lg text-primary mb-2">
          Coming Soon
        </h2>
        <p className="text-body-md font-body-md text-on-surface-variant">
          We are currently working hard on this feature. Check back soon!
        </p>
      </div>
    </div>
  );
}