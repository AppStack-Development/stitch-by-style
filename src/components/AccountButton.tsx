import { useState } from 'react';
import { cloudEnabled, useCloud, type CloudUser, type SyncState } from '../lib/cloud';
import { Icon } from './Icon';
import { t } from '../lib/i18n';

function initials(user: CloudUser): string {
  const src = (user.name || user.email || '?').trim();
  const words = src.split(/[\s@._-]+/).filter(Boolean);
  const chars = words.length > 1 ? [words[0], words[1]].map((w) => Array.from(w)[0]) : Array.from(words[0] ?? '?').slice(0, 1);
  return chars.join('').toUpperCase();
}

/** Round profile picture, falling back to initials when there is none or it fails to load. */
export function Avatar({ user, size }: { user: CloudUser; size: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  const showImg = !!user.avatar && broken !== user.avatar;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {showImg
        ? <img src={user.avatar!} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(user.avatar)} />
        : initials(user)}
    </span>
  );
}

export function syncLabel(sync: SyncState): string {
  switch (sync) {
    case 'syncing': return t('กำลังซิงก์…', 'Syncing…');
    case 'error': return t('ซิงก์ไม่สำเร็จ', 'Sync failed');
    case 'offline': return t('ออฟไลน์', 'Offline');
    default: return t('ซิงก์แล้ว', 'Synced');
  }
}

/** Header control for the optional account. Renders nothing when accounts aren't configured. */
export function AccountButton() {
  const cloud = useCloud();
  if (!cloudEnabled || cloud.status === 'off') return null;

  if (cloud.status === 'signed-in' && cloud.user) {
    const label = `${cloud.user.name} · ${syncLabel(cloud.sync)}`;
    return (
      <a className="btn ghost account-btn icon-only" href="#/account" title={label} aria-label={t(`บัญชี: ${label}`, `Account: ${label}`)}>
        <span className="account-av">
          <Avatar user={cloud.user} size={24} />
          <i className={'sync-dot ' + cloud.sync} />
        </span>
      </a>
    );
  }

  const loading = cloud.status === 'loading';
  const signIn = t('เข้าสู่ระบบ', 'Sign in');
  return (
    <a className={'btn ghost account-btn' + (loading ? ' icon-only' : ' signed-out')} href="#/account"
      title={loading ? t('บัญชี', 'Account') : t('เข้าสู่ระบบเพื่อซิงก์ลายระหว่างอุปกรณ์ (ไม่บังคับ)', 'Sign in to sync your patterns across devices (optional)')}
      aria-label={loading ? t('บัญชี', 'Account') : signIn}>
      <Icon name="user" size={16} />
      {!loading && <span className="account-label">{signIn}</span>}
    </a>
  );
}
