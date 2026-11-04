'use client';

import React, { useState } from 'react';
import {
  UserPlus,
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
} from 'lucide-react';

interface ContactList {
  id: string;
  name: string;
  description?: string | null;
  _count?: { contacts: number };
}

interface ManualAddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContactSaved: (contact: any) => void;
  availableLists: ContactList[];
}

export function ManualAddContactModal({
  isOpen,
  onClose,
  onContactSaved,
  availableLists = [],
}: ManualAddContactModalProps) {
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('91');
  const [name, setName] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [isCreatingNewList, setIsCreatingNewList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [tags, setTags] = useState('');
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([
    { key: 'company', value: '' },
    { key: 'city', value: '' },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Add custom variable row
  const handleAddField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };

  // Remove custom variable row
  const handleRemoveField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  // Update custom variable row
  const handleFieldChange = (index: number, keyOrValue: 'key' | 'value', val: string) => {
    const updated = [...customFields];
    updated[index][keyOrValue] = val;
    setCustomFields(updated);
  };

  // Calculate clean preview number
  const getPreviewNumber = () => {
    let clean = phone.replace(/[^\d]/g, '');
    if (!clean) return '';
    if (clean.length === 10) {
      return `+${countryCode} ${clean}`;
    }
    return `+${clean}`;
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
      let targetListId = selectedListId || undefined;

      // If user opted to create a new list
      if (isCreatingNewList && newListName.trim()) {
        try {
          const listRes = await fetch('/api/contacts/lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newListName.trim() }),
          });
          const listData = await listRes.json();
          if (listRes.ok && listData.list?.id) {
            targetListId = listData.list.id;
          }
        } catch {
          // Continue if list creation fails
        }
      }

      // Collect custom fields object
      const customVariables: Record<string, string> = {};
      customFields.forEach((item) => {
        if (item.key.trim() && item.value.trim()) {
          customVariables[item.key.trim()] = item.value.trim();
        }
      });

      // Parse tags
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          defaultCountryCode: countryCode,
          name: name.trim() || undefined,
          listId: targetListId,
          customFields: Object.keys(customVariables).length > 0 ? customVariables : undefined,
          tags: tagList.length > 0 ? tagList : ['manual'],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create contact');

      onContactSaved(data.contact);
      onClose();

      // Reset fields
      setPhone('');
      setName('');
      setSelectedListId('');
      setIsCreatingNewList(false);
      setNewListName('');
      setTags('');
      setCustomFields([
        { key: 'company', value: '' },
        { key: 'city', value: '' },
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving contact');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Add New Contact</h3>
              <p className="text-xs text-slate-400">Add a single recipient with attributes & list assignment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 font-sans text-xs">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Phone Number */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200">
              Phone Number <span className="text-emerald-400">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 font-mono">
                <span>+</span>
                <input
                  type="text"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.replace(/[^\d]/g, ''))}
                  className="w-8 bg-transparent text-white font-mono focus:outline-none"
                  placeholder="91"
                  maxLength={4}
                  title="Country Calling Code"
                />
              </div>
              <div className="relative flex-1">
                <Phone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210 or 919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
            {phone && (
              <p className="text-[11px] font-mono text-emerald-400/90 pl-1">
                Formatted preview: {getPreviewNumber()}
              </p>
            )}
          </div>

          {/* 2. Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200">
              Contact Full Name <span className="text-slate-500">(Optional)</span>
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* 3. Contact List Assignment */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-200">
                Contact List <span className="text-slate-500">(Optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingNewList(!isCreatingNewList)}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
              >
                <FolderPlus className="w-3 h-3" />
                <span>{isCreatingNewList ? 'Select existing' : '+ Create new list'}</span>
              </button>
            </div>

            {isCreatingNewList ? (
              <input
                type="text"
                placeholder="Enter new list name (e.g. VIP Clients Nov 2026)"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
              />
            ) : (
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="">No List (General All Contacts)</option>
                {availableLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l._count?.contacts ? `(${l._count.contacts} contacts)` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 4. Tags */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200">
              Tags <span className="text-slate-500">(Optional, comma separated)</span>
            </label>
            <div className="relative">
              <Tag className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. VIP, Hot Lead, Customer"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* 5. Custom Variables / Spintax Attributes */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-slate-200">
                  Custom Variables / Spintax Fields
                </label>
                <p className="text-[10px] text-slate-500">
                  Available in template messages as <span className="text-emerald-400 font-mono">{'{{company}}'}</span>, <span className="text-emerald-400 font-mono">{'{{city}}'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddField}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono flex items-center gap-1 transition"
              >
                <Plus className="w-3 h-3 text-emerald-400" />
                <span>Add Variable</span>
              </button>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {customFields.map((field, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Key (e.g. city)"
                    value={field.key}
                    onChange={(e) => handleFieldChange(idx, 'key', e.target.value)}
                    className="w-1/3 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. Mumbai)"
                    value={field.value}
                    onChange={(e) => handleFieldChange(idx, 'value', e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-[11px] focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveField(idx)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                    title="Remove field"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Contact</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
