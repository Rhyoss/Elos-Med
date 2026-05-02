import { redirect } from 'next/navigation';

export default function AnalyticsFinanceiroPage() {
  redirect('/analytics?tab=receita');
}
