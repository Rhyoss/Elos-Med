import { redirect } from 'next/navigation';

export default function AnalyticsPacientesPage() {
  redirect('/analytics?tab=pacientes');
}
