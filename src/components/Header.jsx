import React from 'react';
import { 
  Send, 
  PlusCircle, 
  Radio, 
  History, 
  Settings, 
  Server, 
  CheckCircle2, 
  XCircle, 
  RefreshCw 
} from 'lucide-react';

export default function Header({ 
  currentTab, 
  setCurrentTab, 
  onOpenSettings, 
  instances = [], 
  selectedInstance, 
  activeCampaign,
  connectionState,
  onRefreshInstances,
  loadingInstances 
}) {
  const isConnected = connectionState === 'open' || connectionState === 'connected';

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
              <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white tracking-tight">BulkFlow</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  Evolution v2
                </span>
              </div>
              <p className="text-[11px] text-slate-400">WhatsApp Web Campaign Gateway</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Active Dashboard</span>
              {activeCampaign && activeCampaign.status === 'running' && (
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('wizard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                currentTab === 'wizard'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Campaign</span>
            </button>

            <button
              onClick={() => setCurrentTab('instances')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                currentTab === 'instances'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Instances</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
                {instances.length}
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                currentTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
          </nav>

          {/* Right Status & Settings */}
          <div className="flex items-center gap-3">
            {/* Instance Pill */}
            {selectedInstance ? (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800/70 rounded-xl border border-slate-700 text-xs">
                <span className="text-slate-400 text-[11px]">Instance:</span>
                <span className="font-mono font-medium text-slate-200">{selectedInstance}</span>
                {isConnected ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Connected</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                    <XCircle className="w-3 h-3" />
                    <span>{connectionState || 'Disconnected'}</span>
                  </span>
                )}
              </div>
            ) : null}

            <button
              onClick={onRefreshInstances}
              disabled={loadingInstances}
              title="Refresh Instances and Connection State"
              className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/80 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingInstances ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              onClick={onOpenSettings}
              title="Settings & Evolution API Config"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/90 rounded-xl border border-slate-700 transition cursor-pointer shadow-sm"
            >
              <Settings className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

