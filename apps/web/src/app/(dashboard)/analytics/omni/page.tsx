import { redirect } from 'next/navigation';

export default function AnalyticsOmniPage() {
  redirect('/analytics?tab=comunicacao');
}
