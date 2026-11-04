import React, { useState, useEffect } from 'react';
import { 
  History, 
  Download, 
  Trash2, 
  Radio, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ExternalLink,
  PlusCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from '@/lib/toast';

export default function CampaignHistory({
  onSelectCampaign,
  onNavigateWizard
}) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete campaign "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setCampaigns(prev => prev.filter(c => c.id !== id));
        toast.success(`Campaign "${name}" deleted successfully.`);
      } else {
        toast.error(data.error || 'Failed to delete campaign');
      }
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">Campaign History & Reports</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review past bulk broadcasts, delivery statistics, and export detailed CSV reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadCampaigns}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onNavigateWizard}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* Campaigns List */}
      {loading && campaigns.length === 0 ? (
        <div className="p-16 text-center bg-slate-850/50 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-3" />
          <p className="text-sm text-slate-300">Loading campaign history...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="p-16 text-center bg-slate-850/50 border border-slate-800 rounded-2xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
            <History className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white">No Campaigns Executed Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
            Your bulk WhatsApp campaigns and delivery audit reports will appear here once created.
          </p>
          <button
            onClick={onNavigateWizard}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="bg-slate-850 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-4">Campaign Name</th>
                  <th className="p-4">Instance</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Progress / Sent</th>
                  <th className="p-4">Failed</th>
                  <th className="p-4">Created Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-850/50">
                {campaigns.map((camp) => {
                  const isRunning = camp.status === 'running';
                  const isCompleted = camp.status === 'completed';
                  const isPaused = camp.status === 'paused';
                  const total = camp.total_recipients || camp.total_count || 0;
                  const sent = camp.sent_recipients || camp.sent_count || 0;
                  const failed = camp.failed_recipients || camp.failed_count || 0;
                  const pct = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;

                  return (
                    <tr 
                      key={camp.id}
                      onClick={() => onSelectCampaign(camp.id)}
                      className="hover:bg-slate-800/60 transition cursor-pointer"
                    >
                      <td className="p-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{camp.name}</span>
                          {isRunning && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-emerald-400">
                        {camp.instance_name}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          isRunning ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 animate-pulse' :
                          isCompleted ? 'bg-blue-950 text-blue-300 border border-blue-500/40' :
                          isPaused ? 'bg-amber-950 text-amber-300 border border-amber-500/40' :
                          'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {camp.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-200">{sent} / {total}</span>
                          <span className="text-[10px] text-slate-400">({pct}%)</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-red-400">
                        {failed}
                      </td>
                      <td className="p-4 text-slate-400 font-mono text-[11px]">
                        {camp.created_at ? new Date(camp.created_at).toLocaleString() : '-'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onSelectCampaign(camp.id)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
                            title="Open Campaign Dashboard"
                          >
                            <Radio className="w-3.5 h-3.5 text-emerald-400" />
                          </button>

                          <a
                            href={`/api/campaigns/${camp.id}/export`}
                            download
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
                            title="Export CSV Delivery Report"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                          </a>

                          <button
                            onClick={(e) => handleDelete(camp.id, camp.name, e)}
                            className="p-1.5 bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-300 rounded-lg text-xs font-medium border border-slate-700 hover:border-red-500/30 transition"
                            title="Delete Campaign"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
