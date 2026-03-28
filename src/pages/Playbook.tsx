import { BookOpen } from 'lucide-react';

export default function Playbook() {
  return (
    <div className="max-w-5xl mx-auto text-center py-16">
      <BookOpen size={48} style={{ color: '#f97316', margin: '0 auto 16px' }} />
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>The Playbook</h1>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Trade Performance Journal — Coming Soon</p>
    </div>
  );
}
