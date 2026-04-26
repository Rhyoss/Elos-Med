'use client';

import * as React from 'react';
import { TRIGGER_META, type AutomationTrigger } from '@dermaos/shared';
import { Badge } from '@dermaos/ui';
import { Info } from 'lucide-react';

interface TriggerInfoProps {
  trigger:   AutomationTrigger;
  className?: string;
}

export function TriggerInfo({ trigger, className }: TriggerInfoProps) {
  const meta = TRIGGER_META[trigger];
  return (
    <div className={`rounded-lg border border-border bg-muted/50 p-3 text-sm ${className ?? ''}`}>
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1.5">
          <p className="text-muted-foreground">{meta.description}</p>
          <div className="flex flex-wrap gap-1">
            {meta.variables.map((v) => (
              <Badge key={v} variant="outline" size="sm" className="font-mono text-xs">
                {v}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function triggerLabel(trigger: string): string {
  const meta = TRIGGER_META[trigger as AutomationTrigger];
  return meta?.label ?? trigger;
}
