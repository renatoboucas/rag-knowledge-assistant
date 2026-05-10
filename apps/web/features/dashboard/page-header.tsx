export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <p className="text-primary text-sm font-medium">Workspace</p>
      <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">{title}</h1>
      <p className="text-muted-foreground max-w-3xl text-sm leading-6">{description}</p>
    </div>
  );
}
