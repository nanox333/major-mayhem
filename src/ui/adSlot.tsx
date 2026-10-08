export type AdMode = 'off' | 'placeholder' | 'sponsor';

/**
 * Which slot to show. Off unless enabled. A sponsor needs both a creative and a link; without them the
 * "your ad here" placeholder shows instead, so the space can be seen before anyone has paid for it.
 */
export const adMode = (ads: { enabled: boolean; imageUrl: string; linkUrl: string }): AdMode =>
  !ads.enabled ? 'off' : ads.imageUrl && ads.linkUrl ? 'sponsor' : 'placeholder';

/**
 * A fixed-size slot for a direct sponsor, or a placeholder. It loads no script and no tracker, so it needs no consent.
 * The space is reserved up front so nothing moves, it is hidden on small screens (#283), and the game shows it only on
 * the home screen and the results screen, never during a draft, veto or match.
 */
export function AdSlot() {
  const ads = __SITE__.ads;
  const mode = adMode(ads);
  if (mode === 'off') return null;
  if (mode === 'placeholder') {
    // The call to action names the contact route, so a visitor knows a space can be bought before they ask.
    const cta = ads.contactUrl ? <a className="ad-slot__cta" href={ads.contactUrl}>Advertise here</a> : <span className="ad-slot__cta">Advertise here</span>;
    return (
      <aside className="ad-slot ad-slot--placeholder" aria-label="Advertising space">
        <span className="ad-slot__tag" aria-hidden="true">Ad</span>
        <span className="ad-slot__text"><strong>Your ad here</strong><span>Reach Counter-Strike fans who come back every day.</span></span>
        {cta}
      </aside>
    );
  }
  return (
    <aside className="ad-slot" aria-label="Sponsored">
      <small>Sponsored</small>
      <a href={ads.linkUrl} rel="sponsored noopener" target="_blank">
        <img src={ads.imageUrl} alt={ads.alt} width={728} height={90} loading="lazy" />
      </a>
    </aside>
  );
}
