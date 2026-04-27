import * as React from 'react';
import { EmptyState, type EmptyStateProps } from './EmptyState';

export type ErrorStateProps = Omit<EmptyStateProps, 'tone'>;

export function ErrorState({
  label = 'ESTADO DE ERRO',
  icon = 'alert',
  ...rest
}: ErrorStateProps) {
  return <EmptyState {...rest} icon={icon} label={label} tone="danger" />;
}
