import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../utils.js';

/* ── Primitivos ───────────────────────────────────────────────────────────── */

const TabsRoot = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex overflow-x-auto scrollbar-none border-b border-border',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  count?: number;
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, children, count, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      `relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium
       text-muted-foreground shrink-0
       border-b-2 border-transparent -mb-px
       transition-colors
       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset
       disabled:pointer-events-none disabled:opacity-50
       hover:text-foreground hover:border-border
       data-[state=active]:text-foreground data-[state=active]:border-primary`,
      className,
    )}
    {...props}
  >
    {children}
    {count !== undefined && (
      <span
        className={cn(
          'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-medium',
          'bg-muted text-muted-foreground',
          'data-[state=active]:bg-primary/10 data-[state=active]:text-primary',
        )}
        aria-label={`${count} itens`}
      >
        {count > 99 ? '99+' : count}
      </span>
    )}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

/* ── Tabs composto (sugar) ───────────────────────────────────────────────── */

export interface TabItem {
  value: string;
  label: string;
  count?: number;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps
  extends Omit<React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>, 'children'> {
  items: TabItem[];
  listClassName?: string;
  contentClassName?: string;
}

function Tabs({ items, listClassName, contentClassName, ...props }: TabsProps) {
  return (
    <TabsRoot {...props}>
      <TabsList className={listClassName}>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} count={item.count} disabled={item.disabled}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value} className={contentClassName}>
          {item.content}
        </TabsContent>
      ))}
    </TabsRoot>
  );
}

export { Tabs, TabsRoot, TabsList, TabsTrigger, TabsContent };
