import { redirect } from 'next/navigation';

// Redireciona para /inicio (portal) — o middleware de auth lida com usuários não autenticados
export default function RootPage() {
  redirect('/inicio');
}
