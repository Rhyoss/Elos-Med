import { redirect } from 'next/navigation';

export default async function PatientIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/pacientes/${id}/prontuario`);
}
