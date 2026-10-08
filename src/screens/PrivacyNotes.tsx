import React from 'react';

const PROVIDER_NAME: Record<string, string> = { plausible: 'Plausible', umami: 'Umami', cloudflare: 'Cloudflare Web Analytics' };

/**
 * The privacy notes and disclaimers, shown as a tab in the help dialog. Anything that depends on how the site is set up
 * (analytics) is read from site.config.json, so the text matches what the build actually does. Keep this in step with the
 * code: if a cookie, a tracker or a third-party request is added, this text must change first.
 */
export function PrivacyNotes() {
  const { analytics, sentryLoader } = __SITE__;
  const provider = PROVIDER_NAME[analytics.provider];
  return (
    <>
      <p>Last updated 8 October 2026.</p>

      <h3>What is stored on your device</h3>
      <p>
        Everything the game remembers is kept in this browser's local storage: the run in progress, your stats and achievements,
        your progress in the daily, Guess the pro and Duo Link, your name, and your sound and tips settings. None of it is
        uploaded to us. Clearing this site's data in your browser removes all of it.
      </p>

      <h3>Cookies</h3>
      <p>The game sets no cookies. Local storage is not sent along with web requests.</p>

      <h3>Analytics</h3>
      <p>
        {provider
          ? `The site counts visits with ${provider}. It uses no cookies and records anonymous page views and events only.`
          : 'No analytics are running on this site.'}
        {sentryLoader && ' Errors are reported to Sentry, which can see your IP address and browser details when an error happens.'}
      </p>

      <h3>Ads and sponsors</h3>
      <p>
        There are no ad networks or trackers on the site. A sponsor's image, when one is shown, loads from the sponsor's server,
        which can see your IP address as any image host can. Sponsor links are marked as sponsored and open in a new tab. If an
        ad network is ever added, this page will say so, and you will be asked before it loads.
      </p>

      <h3>Twitch chat</h3>
      <p>
        Turning on Twitch chat connects your browser straight to Twitch's chat servers, anonymously and without logging in.
        Twitch sees that connection like any visit to its site, under its own privacy policy. The game does not save chat
        messages.
      </p>

      <h3>Duel links</h3>
      <p>A duel link carries the draft inside the link itself. Nothing about it is stored on a server.</p>

      <h3>Questions</h3>
      <p>For privacy questions, or to ask for something to be removed, use the Contact page.</p>

      <h3>Disclaimers</h3>
      <p><b>Fan project.</b> Major Mayhem is not affiliated with, endorsed by or sponsored by Valve, any team or any tournament organiser.</p>
      <p><b>Trademarks.</b> Game names, team names and logos belong to their owners. They are used only to identify players and teams.</p>
      <p><b>Simulated results.</b> Matches, ratings and placings are simulated for fun. They are not predictions, and player strength is hidden on purpose.</p>
      <p><b>No money.</b> There are no purchases, prizes or bets, and nothing in the game is for sale.</p>
      <p><b>Accuracy.</b> Rosters and placements come from the public sources listed under Sources and credits. Mistakes happen; tell us if you spot one.</p>
      <p><b>No warranty.</b> The game is provided as it is, without warranty of any kind.</p>
    </>
  );
}
