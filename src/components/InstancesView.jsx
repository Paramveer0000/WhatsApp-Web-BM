import React, { useState } from 'react';
import { 
  Server, 
  PlusCircle, 
  RefreshCw, 
  QrCode, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function InstancesView({
  instances = [],
  loading,
  onRefresh,
  onCreateNew,
  onOpenQR,
  onSelectInstance,
  selectedInstance,
  settings,
  onOpenSettings
}) {
  const [checkingInstance, setCheckingInstance] = useState(null);
  const [states, setStates] = useState({});

  const checkState = async (instanceName) => {
    try {
      setCheckingInstance(instanceName);
      const res = await fetch(`/api/evolution/state/${encodeURIComponent(instanceName)}`);
      const data = await res.json();
      setStates(prev => ({ ...prev, [instanceName]: data.state || 'unknown' }));
    } catch (err) {
      setStates(prev => ({ ...prev, [instanceName]: 'error' }));
    } finally {
      setCheckingInstance(null);
    }
  };

  const checkAllStates = async () => {
    for (const inst of instances) {
      const name = inst.instance?.instanceName || inst.name || inst.instanceName;
      if (name) {
        checkState(name);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">Evolution API Instances</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Connected to gateway: <code className="text-emerald-400 font-mono">{settings.evolution_api_url || 'http://localhost:8080'}</code>
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onOpenSettings}
            className="flex-1 md:flex-initial px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition cursor-pointer"
          >
            Configure Gateway URL
          </button>
          <button
            onClick={() => {
              onRefresh();
              checkAllStates();
            }}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onCreateNew}
            className="flex-1 md:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            New Instance
          </button>
        </div>
      </div>

      {/* Instances Grid */}
      {loading && instances.length === 0 ? (
        <div className="p-12 text-center bg-slate-850/50 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-3" />
          <p className="text-sm text-slate-300">Fetching instances from Evolution API...</p>
        </div>
      ) : instances.length === 0 ? (
        <div className="p-12 text-center bg-slate-850/50 border border-slate-800 rounded-2xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
            <Server className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white">No WhatsApp Instances Found</h3>
          <p className="text-xs text-slate-400 max-w-md mt-1 mb-5">
            Create an instance to link your WhatsApp Web account via QR code and start dispatching bulk campaigns.
          </p>
          <button
            onClick={onCreateNew}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Create Your First Instance
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {instances.map((item, idx) => {
            const inst = item.instance || item;
            const name = inst.instanceName || inst.name || `instance-${idx}`;
            const state = states[name] || inst.connectionStatus || inst.state || 'unknown';
            const isConnected = state === 'open' || state === 'connected';
            const isSelected = selectedInstance === name;

            return (
              <div 
                key={name}
                className={`bg-slate-850 border rounded-2xl p-5 shadow-xl transition flex flex-col justify-between ${
                  isSelected 
                    ? 'border-emerald-500/70 ring-1 ring-emerald-500/50 bg-slate-850/90' 
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-mono text-xs font-bold">
                        WA
                      </div>
                      <span className="font-mono font-bold text-sm text-white truncate" title={name}>
                        {name}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                      isConnected 
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' 
                        : state === 'connecting'
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                        : 'bg-red-950/80 text-red-300 border border-red-500/30'
                    }`}>
                      {isConnected ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : state === 'connecting' ? (
                        <Clock className="w-3 h-3 text-amber-400" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-400" />
                      )}
                      <span>{state}</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="text-[11px] text-slate-400 space-y-1 mb-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="flex justify-between">
                      <span>Engine:</span>
                      <span className="text-slate-200 font-mono">Baileys (v2)</span>
                    </div>
                    {inst.owner && (
                      <div className="flex justify-between">
                        <span>Connected Number:</span>
                        <span className="text-emerald-400 font-mono">{inst.owner}</span>
                      </div>
                    )}
                    {inst.profileName && (
                      <div className="flex justify-between">
                        <span>Profile Name:</span>
                        <span className="text-slate-200">{inst.profileName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onOpenQR(name)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Scan QR</span>
                    </button>
                    <button
                      onClick={() => checkState(name)}
                      disabled={checkingInstance === name}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${checkingInstance === name ? 'animate-spin text-emerald-400' : ''}`} />
                      <span>Check State</span>
                    </button>
                  </div>

                  <button
                    onClick={() => onSelectInstance(name)}
                    className={`w-full py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Selected for Campaign</span>
                      </>
                    ) : (
                      <>
                        <span>Select for Campaign</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

