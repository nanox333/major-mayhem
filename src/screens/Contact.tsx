import React from 'react';

/**
 * Where to go with bugs, ideas, advertising and support. Everything here is a plain link: nothing is stored, sent or
 * tracked by the page. Bugs and advertising enquiries go to the public issue tracker unless an email is set in
 * site.config.json, which adds a direct email button.
 */
export function ContactPage() {
  const { contact, support } = __SITE__;
  const newIssue = (title: string) => `${contact.issuesUrl}/new?title=${encodeURIComponent(title)}`;
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
        <div className="ct-actions">
          {contact.email && <a className="ct-btn" href={`mailto:${contact.email}?subject=${encodeURIComponent('Ad space enquiry')}`}>Email about ads</a>}
          <a className="ct-btn" href={newIssue('Advertising enquiry')} rel="noopener" target="_blank">Open a GitHub issue</a>
        </div>
      </section>

      <section className="ct-card" aria-labelledby="ct-bugs">
        <h4 id="ct-bugs">Bugs and ideas</h4>
        <p>Something broken, or an idea for a mode or a feature? Say what you were doing and which browser you used.</p>
        <div className="ct-actions">
          <a className="ct-btn" href={newIssue('Bug: ')} rel="noopener" target="_blank">Report a bug</a>
          <a className="ct-btn" href={contact.issuesUrl} rel="noopener" target="_blank">Browse open issues</a>
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
