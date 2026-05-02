import { redirect } from 'next/navigation';

export default function AnalyticsSupplyPage() {
  redirect('/analytics?tab=estoque');
}
