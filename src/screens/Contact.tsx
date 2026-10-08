import React from 'react';
import { useT } from '../i18n';

/**
 * Where to go with bugs, advertising and support. Each enquiry is a mailto: link to an address from site.config.json, so
 * the page stores and sends nothing itself.
 */
export function ContactPage({ onPrivacy }: { onPrivacy: () => void }) {
  const t = useT();
  const { contact, support } = __SITE__;
  const mail = (to: string, subject: string, body = '') => `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <main className="console sp ct">
      <header className="sp-hero">
        <div>
          <p className="sp-kicker">{t('contact.kicker')}</p>
          <h3>{t('contact.title')}</h3>
          <p>{t('contact.lead')}</p>
        </div>
      </header>

      <section className="ct-card" aria-labelledby="ct-ads">
        <h4 id="ct-ads">{t('contact.adsTitle')}</h4>
        <p>{t('contact.adsBody')}</p>
        <p>{t('contact.adsAsk')}</p>
        {contact.adsEmail && (
          <div className="ct-actions">
            <a className="ct-btn" href={mail(contact.adsEmail, t('contact.adsSubject'), t('contact.adsPrefill'))}>{t('contact.emailButton', { address: contact.adsEmail })}</a>
          </div>
        )}
      </section>

      <section className="ct-card" aria-labelledby="ct-bugs">
        <h4 id="ct-bugs">{t('contact.bugsTitle')}</h4>
        <p>{t('contact.bugsBody')}</p>
        {contact.bugsEmail && (
          <div className="ct-actions">
            <a className="ct-btn" href={mail(contact.bugsEmail, t('contact.bugsSubject'), t('contact.bugsPrefill'))}>{t('contact.emailButton', { address: contact.bugsEmail })}</a>
          </div>
        )}
      </section>

      <section className="ct-card" aria-labelledby="ct-privacy">
        <h4 id="ct-privacy">{t('contact.privacyTitle')}</h4>
        <p>{t('contact.privacyBody')}</p>
        <div className="ct-actions">
          <button type="button" className="ct-btn" onClick={onPrivacy}>{t('contact.privacyButton')}</button>
        </div>
      </section>

      {support.url && (
        <section className="ct-card" aria-labelledby="ct-support">
          <h4 id="ct-support">{t('contact.supportTitle')}</h4>
          <p>{t('contact.supportBody')}</p>
          <div className="ct-actions">
            <a className="ct-btn" href={support.url} rel="noopener" target="_blank">{support.label}</a>
          </div>
        </section>
      )}
    </main>
  );
}
