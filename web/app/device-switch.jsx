'use client';
// Switch Dispositivi mobili / Computer condiviso da /report e /perf.
import { useLang } from './i18n';

export default function DeviceSwitch({ device, onChange, label }) {
  const { t } = useLang();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
      {label && <span aria-hidden="true" style={{ font: '600 13px var(--mono)', color: 'var(--muted)' }}>{label}</span>}
      {/* aria-pressed e non role="tab": cambia solo la misura mostrata, non è un pannello a schede */}
      <div role="group" aria-label={label ? `${label} ${t('Dispositivo')}` : t('Dispositivo')} style={{ display: 'inline-flex', gap: 4, padding: 4, border: '1px solid var(--card-line)', borderRadius: 999 }}>
        {[['mobile', t('Dispositivi mobili')], ['desktop', t('Computer')]].map(([k, lab]) => (
          <button key={k} type="button" aria-pressed={device === k} onClick={() => onChange(k)}
            style={{ border: 0, borderRadius: 999, padding: '7px 14px', cursor: 'pointer', font: '600 13px var(--mono)', background: device === k ? 'var(--beam)' : 'transparent', color: device === k ? '#062018' : 'var(--muted)' }}>{lab}</button>
        ))}
      </div>
    </div>
  );
}
