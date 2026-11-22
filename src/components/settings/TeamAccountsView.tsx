'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, ShieldCheck, UserCheck, AlertCircle, Loader2, X, Lock, Mail, User as UserIcon } from 'lucide-react';
import { toast } from '@/lib/toast';

interface TeamUser {
  id: string;
  email: string;
  name?: string | null;
  role: 'ADMIN' | 'OPERATOR';
  createdAt: string;
}

export function TeamAccountsView({ currentUserId }: { currentUserId?: string }) {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeamUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'OPERATOR'>('OPERATOR');
  const [formError, setFormError] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load team users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user account');
      }

      toast.success(`Account created for ${email}`);
      setName('');
      setEmail('');
      setPassword('');
      setRole('OPERATOR');
      setModalOpen(false);
      loadUsers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/users?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      toast.success(`User ${deleteTarget.email} removed`);
      setDeleteTarget(null);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 max-w-4xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0c57e4]" />
            Team Accounts & User Access Management
          </h3>
          <p className="text-[11px] text-slate-400">
            Create, manage, and assign role-based permissions (Administrator or Operator) for team members
          </p>
        </div>
        <button
          onClick={() => {
            setFormError('');
            setModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0c57e4] hover:bg-[#0944b5] text-white rounded-xl text-xs font-bold transition shadow-sm shadow-blue-900/30 cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add Team Member</span>
        </button>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center text-slate-500 gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-[#0c57e4]" />
          <span>Loading team accounts...</span>
        </div>
      ) : users.length === 0 ? (
        <div className="py-6 text-center text-slate-500 text-xs">
          No team accounts found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Created</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className="hover:bg-slate-850/50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-[11px]">
                          {u.name ? u.name[0].toUpperCase() : u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-white flex items-center gap-1.5">
                            {u.name || 'Unnamed User'}
                            {isSelf && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-normal">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          <ShieldCheck className="w-3 h-3" />
                          ADMIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 border border-blue-500/30 text-blue-400">
                          <UserCheck className="w-3 h-3" />
                          OPERATOR
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isSelf ? (
                        <span className="text-[10px] text-slate-500 italic">Active Session</span>
                      ) : (
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="p-1 rounded-lg hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title={`Delete ${u.email}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#0c57e4]/10 border border-[#0c57e4]/30 flex items-center justify-center text-[#0c57e4]">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Add Team Member</h3>
                <p className="text-xs text-slate-400">Provision a new authenticated login account</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{formError}</p>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Rahul Sharma"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#0c57e4]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#0c57e4]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password (min 6 characters)</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#0c57e4]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Access Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0c57e4]"
                >
                  <option value="OPERATOR">OPERATOR (Campaign broadcasts, contacts, live inbox)</option>
                  <option value="ADMIN">ADMINISTRATOR (Full platform control, settings, user management)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#0c57e4] hover:bg-[#0944b5] text-white text-xs font-bold rounded-xl transition shadow-sm shadow-blue-900/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h4 className="text-sm font-bold text-white mb-2">Delete Team Account?</h4>
            <p className="text-xs text-slate-400 mb-4">
              Are you sure you want to remove <strong className="text-white">{deleteTarget.email}</strong>? They will lose access to the platform immediately.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleting}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-sm shadow-rose-900/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete User</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
