'use client';

import { Topbar } from '@/components/Topbar';
import { Modal } from '@/components/Modal';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type TeamMember = {
  id: string;
  email: string;
  role: string;
  store_name: string;
  subscription_status: string;
  created_at: string;
};

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchTeam = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
    setCurrentUser(profile);
    setStoreName(profile?.store_name || '');

    // Admins see all users, owners see just themselves for now
    const { data } = await supabase.from('users').select('*').order('created_at');
    if (data) setTeam(data);
    setLoading(false);
  };

  useEffect(() => { fetchTeam(); }, []);

  const handleSaveStoreName = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('users').update({ store_name: storeName }).eq('id', user.id);
    setMessage('Store name updated!');
    setShowEdit(false);
    fetchTeam();
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const roleColor: Record<string, string> = {
    admin: 'text-[var(--color-red)] bg-[var(--color-red-bg)]',
    owner: 'text-[var(--color-teal)] bg-[var(--color-teal-bg)]',
    manager: 'text-[var(--color-amber)] bg-[var(--color-amber-bg)]',
    employee: 'text-[var(--color-slate)] bg-[var(--color-canvas)]',
  };

  const statusColor: Record<string, string> = {
    trial: 'text-[var(--color-amber)] bg-[var(--color-amber-bg)]',
    active: 'text-[var(--color-emerald)] bg-[var(--color-emerald-bg)]',
    expired: 'text-[var(--color-red)] bg-[var(--color-red-bg)]',
  };

  return (
    <div>
      <Topbar title="Team & Settings" sub="Manage your store profile and team" />
      <div className="p-4 max-w-[900px] mx-auto">

        {message && (
          <div className="mb-4 text-[13px] font-bold text-[var(--color-emerald)] bg-[var(--color-emerald-bg)] py-[8px] px-[12px] rounded-[8px]">
            {message}
          </div>
        )}

        {/* Store Profile Card */}
        <div className="bg-white rounded-[16px] border border-[var(--color-line-lt)] shadow-sm p-5 mb-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="font-serif text-[18px] font-bold text-[var(--color-ink)]">
                {currentUser?.store_name || 'My Store'}
              </div>
              <div className="text-[13px] text-[var(--color-muted)] mt-1">{currentUser?.email}</div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full capitalize ${roleColor[currentUser?.role || 'owner'] || ''}`}>
                  {currentUser?.role}
                </span>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full capitalize ${statusColor[currentUser?.subscription_status || 'trial'] || ''}`}>
                  {currentUser?.subscription_status}
                </span>
              </div>
            </div>
            <button onClick={() => setShowEdit(true)} className="px-4 py-2 bg-[var(--color-teal)] text-white rounded-[8px] font-bold text-[12px] hover:opacity-90">
              ✏️ Edit Store Name
            </button>
          </div>
        </div>

        {/* Team Table */}
        {currentUser?.role === 'admin' && (
          <div className="bg-white rounded-[16px] border border-[var(--color-line-lt)] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--color-line-lt)]">
              <div className="font-serif text-[16px] font-bold text-[var(--color-ink)]">All Users</div>
              <div className="text-[11px] text-[var(--color-muted)]">Platform-wide user accounts</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-[var(--color-canvas)] border-b border-[var(--color-line-lt)]">
                    {['Email', 'Store Name', 'Role', 'Status', 'Joined'].map(h => (
                      <th key={h} className="p-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="p-4 text-center text-[13px] text-[var(--color-muted)]">Loading...</td></tr>
                  ) : team.map(member => (
                    <tr key={member.id} className="border-b border-[var(--color-line-lt)] hover:bg-[var(--color-canvas)]">
                      <td className="p-3 text-[13px] font-semibold text-[var(--color-ink)]">{member.email}</td>
                      <td className="p-3 text-[12px] text-[var(--color-slate)]">{member.store_name || '—'}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full capitalize ${roleColor[member.role] || ''}`}>{member.role}</span>
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full capitalize ${statusColor[member.subscription_status] || ''}`}>{member.subscription_status}</span>
                      </td>
                      <td className="p-3 text-[11px] text-[var(--color-muted)]">{new Date(member.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentUser?.role !== 'admin' && (
          <div className="bg-[var(--color-canvas)] rounded-[14px] p-5 text-center border border-[var(--color-line-lt)]">
            <div className="text-[28px] mb-2">👥</div>
            <div className="font-serif text-[16px] font-bold text-[var(--color-ink)] mb-1">Team management coming soon</div>
            <p className="text-[13px] text-[var(--color-muted)]">Invite managers and employees with role-based access in a future update.</p>
          </div>
        )}
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)}>
        <h2 className="font-serif text-[18px] font-bold text-[var(--color-ink)] mb-4">Edit Store Name</h2>
        <div className="mb-4">
          <label className="text-[12px] font-bold text-[var(--color-slate)] block mb-2">Store / Business Name</label>
          <input
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            placeholder="e.g. Mama Njeri's Pub"
            className="w-full py-[10px] px-[12px] border-[1.5px] border-[var(--color-line)] rounded-[9px] text-[14px] outline-none focus:border-[var(--color-teal)]"
          />
          <p className="text-[11px] text-[var(--color-muted)] mt-2">This name will appear in your dashboard and sidebar.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowEdit(false)} className="flex-1 py-[11px] bg-[var(--color-canvas)] text-[var(--color-slate)] border-[1.5px] border-[var(--color-line)] rounded-[10px] font-bold text-[14px]">Cancel</button>
          <button onClick={handleSaveStoreName} disabled={saving} className="flex-1 py-[11px] bg-[var(--color-teal)] text-white rounded-[10px] font-bold text-[14px] disabled:opacity-70">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>
    </div>
  );
}
