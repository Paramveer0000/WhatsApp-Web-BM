import React, { useState, useEffect, useRef } from 'react';
import { X, QrCode, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Smartphone, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function QRCodeModal({ isOpen, instanceName, onClose, onConnected }) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('connecting'); // connecting, open, close
  const pollTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen && instanceName) {
      loadQRCode();
      startPollingState();
    }

    return () => {
      stopPollingState();
    };
  }, [isOpen, instanceName]);

  const stopPollingState = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const loadQRCode = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/evolution/connect/${encodeURIComponent(instanceName)}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch QR Code');
      }

      // Handle Evolution API v2 variations of QR responses
      let base64 = null;
      let code = null;

      if (data.data) {
        if (data.data.base64) base64 = data.data.base64;
        else if (data.data.qrcode?.base64) base64 = data.data.qrcode.base64;
        else if (typeof data.data === 'string' && data.data.startsWith('data:image')) base64 = data.data;

        if (data.data.code) code = data.data.code;
        else if (data.data.qrcode?.code) code = data.data.qrcode.code;
      }

      if (base64 && !base64.startsWith('data:image')) {
        base64 = `data:image/png;base64,${base64}`;
      }

      setQrData({ base64, code, raw: data.data });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkState = async () => {
    try {
      const res = await fetch(`/api/evolution/state/${encodeURIComponent(instanceName)}`);
      const data = await res.json();
      const state = (data.state || '').toLowerCase();
      setConnectionState(state);

      if (state === 'open' || state === 'connected') {
        stopPollingState();
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch {}

        if (onConnected) onConnected(instanceName);
      }
    } catch (err) {
      console.warn('Polling error:', err);
    }
  };

  const startPollingState = () => {
    stopPollingState();
    pollTimerRef.current = setInterval(checkState, 3000);
    checkState();
  };

  if (!isOpen) return null;

  const isConnected = connectionState === 'open' || connectionState === 'connected';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">
              Connect Instance: <span className="font-mono text-emerald-400">{instanceName}</span>
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center text-center">
          {isConnected ? (
            <div className="py-8 space-y-4 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-900/40">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-bold text-white">WhatsApp Connected!</h3>
              <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                Instance <strong className="text-emerald-400 font-mono">{instanceName}</strong> is linked and ready for campaign dispatches.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-900/30 transition cursor-pointer"
              >
                Proceed to Campaign
              </button>
            </div>
          ) : (
            <>
              <div className="relative mb-5 bg-white p-3 rounded-2xl shadow-xl flex items-center justify-center min-w-[240px] min-h-[240px]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-700">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    <span className="text-xs font-medium">Generating QR Code...</span>
                  </div>
                ) : qrData?.base64 ? (
                  <img
                    src={qrData.base64}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 object-contain rounded-lg"
                  />
                ) : (
                  <div className="p-4 text-xs text-slate-700 flex flex-col items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                    <span>No QR image returned. Instance might already be connected or initializing.</span>
                    <button
                      onClick={loadQRCode}
                      className="mt-2 text-emerald-700 font-semibold underline text-xs"
                    >
                      Retry QR fetch
                    </button>
                  </div>
                )}
              </div>

              {/* Status pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300 mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live State: <strong className="capitalize text-emerald-400">{connectionState}</strong></span>
              </div>

              {/* Instructions */}
              <div className="text-left bg-slate-850 border border-slate-800 rounded-xl p-3.5 w-full text-xs text-slate-300 space-y-2 mb-4">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>How to scan:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1 text-[11px] leading-relaxed">
                  <li>Open <strong>WhatsApp</strong> on your phone</li>
                  <li>Tap <strong>Settings / Menu (⋮)</strong> &rarr; <strong>Linked Devices</strong></li>
                  <li>Tap <strong>Link a Device</strong> and point your camera here</li>
                </ol>
              </div>

              {error && (
                <div className="mb-4 p-2.5 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-200 w-full text-left">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between w-full pt-2">
                <button
                  type="button"
                  onClick={() => {
                    loadQRCode();
                    checkState();
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh QR
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

