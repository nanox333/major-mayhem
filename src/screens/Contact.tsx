import React from 'react';

/**
 * Where to go with bugs, advertising and support. Each enquiry is a mailto: link to an address from site.config.json, so
 * the page stores and sends nothing itself.
 */
export function ContactPage({ onPrivacy }: { onPrivacy: () => void }) {
  const { contact, support } = __SITE__;
  const mail = (to: string, subject: string, body = '') => `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <main className="console sp ct">
      <header className="sp-hero">
        <div>
          <p className="sp-kicker">Contact</p>
          <h3>Get in touch</h3>
          <p>Bugs, ideas, advertising or anything else.</p>
        </div>
      </header>

      <section className="ct-card" aria-labelledby="ct-ads">
        <h4 id="ct-ads">Advertise here</h4>
        <p>
          There are two ad spaces: the home screen and the results screen. Each one is labelled and fixed in size. Nothing
          moves or pops up, and no ad appears during a draft, a veto or a match.
        </p>
        <p>Tell us what you'd like to promote, with a link to it, and we'll say whether a space is free.</p>
        {contact.adsEmail && (
          <div className="ct-actions">
            <a className="ct-btn" href={mail(contact.adsEmail, 'Ad space enquiry', 'What would you like to promote, and what is the link?')}>Email {contact.adsEmail}</a>
          </div>
        )}
      </section>

      <section className="ct-card" aria-labelledby="ct-bugs">
        <h4 id="ct-bugs">Bugs and ideas</h4>
        <p>Something broken, or an idea for a mode or a feature? Say what you were doing and which browser you used.</p>
        {contact.bugsEmail && (
          <div className="ct-actions">
            <a className="ct-btn" href={mail(contact.bugsEmail, 'Bug report', 'What were you doing, and which browser were you using?')}>Email {contact.bugsEmail}</a>
          </div>
        )}
      </section>

      <section className="ct-card" aria-labelledby="ct-privacy">
        <h4 id="ct-privacy">Privacy and disclaimers</h4>
        <p>What the game stores in your browser, what it sends, and what it does not do.</p>
        <div className="ct-actions">
          <button type="button" className="ct-btn" onClick={onPrivacy}>Read the privacy notes</button>
        </div>
      </section>

      {support.url && (
        <section className="ct-card" aria-labelledby="ct-support">
          <h4 id="ct-support">Support the project</h4>
          <p>Optional. It helps cover hosting and future features, and it gets you nothing in the game.</p>
          <div className="ct-actions">
            <a className="ct-btn" href={support.url} rel="noopener" target="_blank">{support.label}</a>
          </div>
        </section>
      )}
    </main>
  );
}
