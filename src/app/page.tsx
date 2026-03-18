import { redirect } from 'next/navigation';

export default function Home() {
  // Middleware handles redirect — this is a fallback
  redirect('/dashboard');
}
