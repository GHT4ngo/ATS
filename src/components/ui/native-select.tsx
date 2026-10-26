import { cn } from "@/lib/utils";

/**
 * A styled native select, which posts its value in plain forms. The options
 * get the popover colours, as some browsers otherwise draw the open list
 * light with the select's light text in dark mode.
 */
export function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "border-input bg-background dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 [&_option]:bg-popover [&_option]:text-popover-foreground h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50 dark:[color-scheme:dark]",
        className,
      )}
      {...props}
    />
  );
}
