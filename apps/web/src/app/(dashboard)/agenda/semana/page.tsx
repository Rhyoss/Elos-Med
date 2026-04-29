import { redirect } from 'next/navigation';

/**
 * A view de semana foi consolidada em /agenda com toggle DIA/SEMANA.
 * Mantemos esta rota como alias compatível com bookmarks antigos.
 */
export default function SemanaRedirect() {
  redirect('/agenda');
}
