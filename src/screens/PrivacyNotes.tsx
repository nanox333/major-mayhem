import React from 'react';
import { tNode, useT } from '../i18n';

const PROVIDER_NAME: Record<string, string> = { plausible: 'Plausible', umami: 'Umami', cloudflare: 'Cloudflare Web Analytics' };

/**
 * The privacy notes and disclaimers, shown as a tab in the help dialog. Anything that depends on how the site is set up
 * (analytics) is read from site.config.json, so the text matches what the build actually does. Keep this in step with the
 * code: if a cookie, a tracker or a third-party request is added, this text must change first.
 */
export function PrivacyNotes() {
  const t = useT();
  const { analytics, sentryLoader } = __SITE__;
  const provider = PROVIDER_NAME[analytics.provider];
  return (
    <>
      <p>{t('privacy.updated')}</p>

      <h3>{t('privacy.storedTitle')}</h3>
      <p>{t('privacy.storedBody')}</p>

      <h3>{t('privacy.cookiesTitle')}</h3>
      <p>{t('privacy.cookiesBody')}</p>

      <h3>{t('privacy.analyticsTitle')}</h3>
      <p>
        {provider ? t('privacy.analyticsOn', { provider }) : t('privacy.analyticsOff')}
        {sentryLoader && ` ${t('privacy.sentry')}`}
      </p>

      <h3>{t('privacy.adsTitle')}</h3>
      <p>{t('privacy.adsBody')}</p>

      <h3>{t('privacy.twitchTitle')}</h3>
      <p>{t('privacy.twitchBody')}</p>

      <h3>{t('privacy.duelTitle')}</h3>
      <p>{t('privacy.duelBody')}</p>

      <h3>{t('privacy.questionsTitle')}</h3>
      <p>{t('privacy.questionsBody')}</p>

      <h3>{t('privacy.disclaimersTitle')}</h3>
      <p>{tNode('privacy.disclaimerFan', { label: <b>{t('privacy.labelFan')}</b> })}</p>
      <p>{tNode('privacy.disclaimerTrademarks', { label: <b>{t('privacy.labelTrademarks')}</b> })}</p>
      <p>{tNode('privacy.disclaimerSimulated', { label: <b>{t('privacy.labelSimulated')}</b> })}</p>
      <p>{tNode('privacy.disclaimerMoney', { label: <b>{t('privacy.labelMoney')}</b> })}</p>
      <p>{tNode('privacy.disclaimerAccuracy', { label: <b>{t('privacy.labelAccuracy')}</b> })}</p>
      <p>{tNode('privacy.disclaimerWarranty', { label: <b>{t('privacy.labelWarranty')}</b> })}</p>
    </>
  );
}
