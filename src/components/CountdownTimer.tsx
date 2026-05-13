import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface CountdownTimerProps {
  eventName: string;
  targetDate: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calcTimeLeft(targetDate: string): TimeLeft {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

export default function CountdownTimer({ eventName, targetDate }: CountdownTimerProps) {
  const [time, setTime] = useState<TimeLeft>(() => calcTimeLeft(targetDate));

  useEffect(() => {
    setTime(calcTimeLeft(targetDate));
    const interval = setInterval(() => setTime(calcTimeLeft(targetDate)), 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const pad = (n: number) => String(n).padStart(2, '0');

  const formattedDate = (() => {
    try {
      return format(new Date(targetDate), 'd MMMM yyyy', { locale: id });
    } catch {
      return targetDate;
    }
  })();

  return (
    <div className="w-full rounded-[32px] overflow-hidden shadow-2xl border border-slate-700/50 mb-20"
      style={{ background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 50%, #0a3880 100%)' }}
    >
      {/* Event Name */}
      <div className="px-8 pt-10 pb-6 text-center">
        <h3 className="text-2xl md:text-3xl font-black tracking-tight text-white">{eventName}</h3>
      </div>

      {/* Countdown Numbers */}
      {time.expired ? (
        <div className="px-8 pb-8 text-center">
          <p className="text-2xl font-black italic tracking-tighter text-white/80 uppercase">Event Telah Berakhir</p>
        </div>
      ) : (
        <div className="px-6 md:px-12 pb-8">
          <div className="grid grid-cols-4 gap-0">
            {[
              { value: time.days, label: 'days' },
              { value: time.hours, label: 'hours' },
              { value: time.minutes, label: 'minutes' },
              { value: time.seconds, label: 'seconds' },
            ].map((item, i) => (
              <div key={item.label} className="flex items-center">
                <div className="flex-1 flex flex-col items-center py-4">
                  <span className="text-5xl md:text-7xl font-black text-white leading-none tabular-nums">
                    {pad(item.value)}
                  </span>
                  <span className="text-[10px] md:text-xs font-bold text-white/60 uppercase tracking-widest mt-2">
                    {item.label}
                  </span>
                </div>
                {i < 3 && (
                  <div className="w-px h-16 bg-white/20 mx-1 md:mx-2 self-center" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Date Footer */}
      <div className="border-t border-white/10 px-8 py-5 text-center"
        style={{ background: 'rgba(0,0,0,0.15)' }}
      >
        <p className="text-sm md:text-base font-black text-white tracking-wide">{formattedDate}</p>
      </div>
    </div>
  );
}
