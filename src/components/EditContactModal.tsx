'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  FolderPlus,
  Tag,
  Phone,
  User,
  Sparkles,
  Edit3,
  ShieldAlert,
} from 'lucide-react';

interface ContactList {
  id: string;
  name: string;
  description?: string | null;
  _count?: { contacts: number };
}

interface EditContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: any;
  availableLists: ContactList[];
  onContactSaved: (updatedContact: any) => void;
  onContactDeleted?: (contactId: string) => void;
}

export function EditContactModal({
  isOpen,
  onClose,
  contact,
  availableLists = [],
  onContactSaved,
  onContactDeleted,
}: EditContactModalProps) {
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('91');
  const [name, setName] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [tags, setTags] = useState('');
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Populate state whenever contact changes
  useEffect(() => {
    if (contact && isOpen) {
      setName(contact.name || '');
      setPhone(contact.phone || '');
      setIsBlacklisted(Boolean(contact.isBlacklisted));

      // Extract country code if starts with standard prefix
      if (contact.phone && contact.phone.length > 10) {
        const potentialCc = contact.phone.slice(0, contact.phone.length - 10);
        if (potentialCc) setCountryCode(potentialCc);
      }

      // Populate list id
      const currentListId = contact.lists?.[0]?.listId || contact.listId || '';
      setSelectedListId(currentListId);

      // Populate tags
      if (contact.tags) {
        try {
          const parsed = typeof contact.tags === 'string' ? JSON.parse(contact.tags) : contact.tags;
          if (Array.isArray(parsed)) {
            setTags(parsed.join(', '));
          } else {
            setTags(String(contact.tags));
          }
        } catch {
          setTags(String(contact.tags));
        }
      } else {
        setTags('');
      }

      // Populate customFields
      const fields: Array<{ key: string; value: string }> = [];
      const rawCf = contact.customFields || contact.customVariables;
      if (rawCf) {
        try {
          const parsed = typeof rawCf === 'string' ? JSON.parse(rawCf) : rawCf;
          if (typeof parsed === 'object' && parsed !== null) {
            Object.entries(parsed).forEach(([k, v]) => {
              fields.push({ key: k, value: String(v) });
            });
          }
        } catch {}
      }
      if (fields.length === 0) {
        fields.push({ key: 'company', value: '' });
        fields.push({ key: 'city', value: '' });
      }
      setCustomFields(fields);
      setErrorMsg('');
    }
  }, [contact, isOpen]);

  if (!isOpen || !contact) return null;

  const handleAddField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };

  const handleRemoveField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, keyOrValue: 'key' | 'value', val: string) => {
    const updated = [...customFields];
    updated[index][keyOrValue] = val;
    setCustomFields(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanPhone = phone.trim().replace(/[^\d]/g, '');
    if (!cleanPhone) {
      setErrorMsg('Please enter a valid phone number.');
      return;
    }

    setIsSaving(true);

    try {
      // Build custom fields object
      const cfObject: Record<string, string> = {};
      for (const item of customFields) {
        const k = item.key.trim();
        if (k) {
          cfObject[k] = item.value.trim();
        }
      }

      // Format tags as array
      const tagsArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        name: name.trim(),
        phone: cleanPhone,
        defaultCountryCode: countryCode,
        listId: selectedListId || 'none',
        customFields: Object.keys(cfObject).length > 0 ? cfObject : null,
        tags: tagsArray.length > 0 ? tagsArray : null,
        isBlacklisted,
      };

      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update contact');
      }

      onContactSaved(data.contact || { ...contact, ...payload });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete "${contact.name || contact.phone}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete contact');
      }

      if (onContactDeleted) {
        onContactDeleted(contact.id);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete contact');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Edit Contact</h3>
              <p className="text-xs text-slate-400 font-mono">+{contact.phone}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Phone Number Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Phone Number</span>
            </label>
            <div className="flex gap-2">
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-300 shrink-0">
                <span className="text-emerald-400 font-bold mr-1">+</span>
                <input
                  type="text"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.replace(/[^\d]/g, ''))}
                  className="w-8 bg-transparent text-white font-mono focus:outline-none"
                  placeholder="91"
                  maxLength={4}
                  title="Default Country Code"
                />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/60"
                required
              />
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Contact Name</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          {/* List Assignment */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Contact List</span>
            </label>
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60 font-mono"
            >
              <option value="">(No List / Unassigned)</option>
              {availableLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l._count?.contacts || 0} contacts)
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tags (comma-separated)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. vip, lead, premium"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          {/* Custom Variables Section */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Custom Variables (e.g. {"{company}"}, {"{city}"})</span>
              </label>
              <button
                type="button"
                onClick={handleAddField}
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
              >
                <Plus className="w-3 h-3" />
                <span>Add Variable</span>
              </button>
            </div>

            <div className="space-y-2">
              {customFields.map((cf, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cf.key}
                    onChange={(e) => handleFieldChange(idx, 'key', e.target.value)}
                    placeholder="Variable key (e.g. city)"
                    className="w-1/3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/60"
                  />
                  <input
                    type="text"
                    value={cf.value}
                    onChange={(e) => handleFieldChange(idx, 'value', e.target.value)}
                    placeholder="Value (e.g. Delhi)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveField(idx)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                    title="Remove field"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Blacklist Status */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isBlacklisted}
                onChange={(e) => setIsBlacklisted(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-rose-500 focus:ring-0 focus:outline-none"
              />
              <span className="flex items-center gap-1.5 text-slate-300">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Mark as Blacklisted / Opted Out</span>
              </span>
            </label>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Contact'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || isDeleting}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950/50 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
