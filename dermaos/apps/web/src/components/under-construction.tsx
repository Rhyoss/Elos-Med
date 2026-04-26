import { PageHeader, EmptyState } from '@dermaos/ui';
import type { ReactNode } from 'react';

interface UnderConstructionProps {
  title:       string;
  description?: string;
  actions?:    ReactNode;
}

export function UnderConstruction({ title, description, actions }: UnderConstructionProps) {
  return (
    <div className="flex flex-col">
      <PageHeader title={title} description={description} actions={actions} />
      <div className="p-6">
        <EmptyState
          title="Em construção"
          description="Este módulo está sendo desenvolvido e estará disponível em breve."
        />
      </div>
    </div>
  );
}
