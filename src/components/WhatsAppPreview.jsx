import React, { useState } from 'react';
import { formatWhatsAppTextToHtml, renderMessage } from '../utils/spintax';
import { Phone, Video, MoreVertical, CheckCheck, RefreshCw, Smartphone } from 'lucide-react';

export default function WhatsAppPreview({ template, recipients = [], defaultRecipient = {} }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [rerollKey, setRerollKey] = useState(0);

  const activeRecipient = recipients[selectedIndex] || defaultRecipient || {
    name: 'Rahul Sharma',
    phone: '919876543210',
    custom_variables: { company: 'Acme Corp', city: 'Mumbai' }
  };

  const currentVars = {
    name: activeRecipient.name || 'Rahul Sharma',
    phone: activeRecipient.phone || '919876543210',
    ...(activeRecipient.custom_variables || {})
  };

  // Re-evaluates on rerollKey to test Spintax randomization
  const renderedText = React.useMemo(() => {
    return renderMessage(template, activeRecipient);
  }, [template, activeRecipient, rerollKey]);

  const htmlContent = formatWhatsAppTextToHtml(renderedText);

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Header / Preview Controls */}
      <div className="px-4 py-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-200">Live WhatsApp Preview</span>
        </div>

        <div className="flex items-center gap-2">
          {recipients.length > 1 && (
            <select
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
              aria-label="Select preview contact"
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
            >
              {recipients.slice(0, 10).map((r, idx) => (
                <option key={idx} value={idx}>
                  {r.name ? `${r.name} (${r.phone})` : r.phone}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setRerollKey(k => k + 1)}
            title="Randomize Spintax Variation"
            className="flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 px-2.5 py-1 rounded border border-emerald-500/30 font-medium transition cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Spintax Reroll</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Device Mockup */}
      <div className="flex-1 flex flex-col bg-[#0b141a] relative overflow-hidden min-h-[380px]">
        {/* WhatsApp App Bar */}
        <div className="bg-[#202c33] px-3 py-2 flex items-center justify-between border-b border-[#2a3942] z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-700/60 flex items-center justify-center font-bold text-white text-sm shadow">
              {(currentVars.name || currentVars.phone || 'W')[0].toUpperCase()}
            </div>
            <div>
              <div className="text-white text-sm font-medium leading-tight">
                {currentVars.name || currentVars.phone}
              </div>
              <div className="text-emerald-400 text-[11px] leading-tight">
                online
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <Video className="w-4 h-4 cursor-pointer hover:text-slate-200" />
            <Phone className="w-4 h-4 cursor-pointer hover:text-slate-200" />
            <MoreVertical className="w-4 h-4 cursor-pointer hover:text-slate-200" />
          </div>
        </div>

        {/* Chat Wallpaper & Message Area */}
        <div 
          className="flex-1 p-4 overflow-y-auto flex flex-col justify-end relative"
          style={{
            backgroundImage: `radial-gradient(circle at center, rgba(16, 185, 129, 0.03) 0%, rgba(0, 0, 0, 0.4) 100%)`
          }}
        >
          {/* WhatsApp Sent Message Bubble */}
          <div className="self-end max-w-[85%] bg-[#005c4b] text-[#e9edef] rounded-lg rounded-tr-none px-3 py-2 shadow-md relative text-sm leading-relaxed break-words border border-[#005c4b]/50">
            {htmlContent ? (
              <div 
                className="prose-invert" 
                dangerouslySetInnerHTML={{ __html: htmlContent }} 
              />
            ) : (
              <span className="text-emerald-300/50 italic text-xs">
                Type your message template on the left to see the live WhatsApp preview...
              </span>
            )}
            
            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#8696a0]">
              <span>{currentTime}</span>
              <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
            </div>
          </div>
        </div>

        {/* WhatsApp Fake Input Footer */}
        <div className="bg-[#202c33] px-3 py-2 flex items-center gap-2 border-t border-[#2a3942] z-10 opacity-70">
          <div className="flex-1 bg-[#2a3942] rounded-lg px-3 py-1.5 text-xs text-slate-400 flex items-center justify-between">
            <span>Type a message...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

