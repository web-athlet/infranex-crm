type DashboardPlaceholderProps = {
  title: string;
};

export function DashboardPlaceholder({ title }: DashboardPlaceholderProps) {
  return (
    <section className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Dieses Modul wird in einer späteren Session implementiert.
      </p>
    </section>
  );
}
