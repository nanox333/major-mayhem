import React from 'react';
import { ROLE_LABEL } from '../data/rosters';
import * as G from '../game/logic';
import { Action, Run, benchLineup } from '../game/state';
import { challengerLineup } from '../game/duel';
import { Avatar, RatingMark, RoleIcon, Sr, TeamBadge } from '../ui/art';
import { fmt, ratingClass } from '../ui/util';
import { Synergy, nationCore, strength } from '../game/synergy';
import { chemistryWord, mapComfort } from '../game/draftui';
import { ArrivalFocus } from '../ui/ArrivalFocus';

export function RosterList({ mine, stats, mvpId }: { mine: G.Lineup[]; stats?: Record<string, { k: number; d: number; rating: number }>; mvpId?: string }) {
  return (
    <ul className="lobby">
      {mine.map((l, i) => {
        const main = l.player.roles[0] === l.slot;
        const st = stats?.[l.player.id];
        return (
          <li key={l.player.id} className={`lobby__row anim-in ${mvpId === l.player.id ? 'is-mvp' : ''}`} style={{ animationDelay: `${i * 55}ms` }}>
            <span className="lobby__avatar"><Avatar player={l.player} roster={l.roster} /></span>
            <span className="lobby__who">
              <strong>{l.player.nick}{mvpId === l.player.id && <em className="mvp-tag">★ MVP</em>}</strong>
              <small><TeamBadge roster={l.roster} size={14} /> {l.roster.org} {l.roster.year}</small>
            </span>
            <span className="lobby__slot" title={main ? 'Main role' : 'Playing an off-role (small penalty)'}>
              <RoleIcon role={l.slot} size={14} /> {ROLE_LABEL[l.slot]}{!main && <i className="offrole">off-role</i>}
            </span>
            {st && <span className="lobby__stat"><small>{st.k}–{st.d}</small><b className={ratingClass(st.rating)}>{fmt(st.rating)}<RatingMark r={st.rating} /></b></span>}
          </li>
        );
      })}
    </ul>
  );
}

/** The synergies behind a lineup's chemistry, strongest first, with their size as + / − marks. `detail` adds a line saying who they come from. */
export function SynergyList({ list, detail }: { list: Synergy[]; detail?: (x: Synergy) => string }) {
  if (!list.length) return <p className="muted small">No synergies: five strangers from five different eras and countries.</p>;
  return (
    <ul className="synergies">
      {list.map((x) => {
        const more = detail?.(x);
        return (
          <li key={x.label} className={`syn syn--${x.kind} ${x.value < 0 ? 'is-bad' : ''}`}>
            <b>{strength(x.value)}</b><span>{x.label}{more && <small>{more}</small>}</span>
          </li>
        );
      })}
    </ul>
  );
}

const CIS = ['RU', 'UA', 'KZ', 'BY'];
/** Who a link comes from, worked out from the five (display only: the game's numbers are unchanged). */
function linkDetail(x: Synergy, mine: G.Lineup[]): string {
  const nicks = (ls: G.Lineup[]) => ls.map((l) => l.player.nick).join(', ');
  switch (x.kind) {
    case 'nation': {
      const key = nationCore(mine.map((l) => l.player)).key;
      return `${nicks(mine.filter((l) => l.player.country === key || (key === 'CIS' && CIS.includes(l.player.country))))} share a nationality.`;
    }
    case 'lineup': {
      const pairs: string[] = [];
      for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) {
        const a = mine[i], b = mine[j];
        const why = a.roster.id === b.roster.id ? 'same roster' : a.roster.org === b.roster.org ? 'same organization' : Math.abs(a.roster.year - b.roster.year) <= 1 ? 'neighbouring years' : '';
        if (why) pairs.push(`${a.player.nick} + ${b.player.nick} (${why})`);
      }
      return pairs.length > 3 ? `${pairs.slice(0, 3).join('; ')}; and ${pairs.length - 3} more.` : `${pairs.join('; ')}.`;
    }
    case 'duo': return 'A famous pair, both on your team.';
    case 'era': return `Every roster is from the same era (${mine.map((l) => l.roster.year).sort().filter((v, i, a) => a.indexOf(v) === i).join(', ')}).`;
    case 'coach': return 'Your coach has led them at a Major before.';
    case 'awp': return 'Only one player can use the AWP at a time, so the second main AWPer costs you.';
    default: return '';
  }
}

/** Chemistry at a glance: one word and its pips, then the facts the links are built from. */
function ChemistrySummary({ mine, links }: { mine: G.Lineup[]; links: Synergy[] }) {
  const { word, pips } = chemistryWord(links);
  const good = links.filter((x) => x.value > 0).length, bad = links.filter((x) => x.value < 0).length;
  const mains = mine.filter((l) => l.player.roles[0] === l.slot).length;
  const nations = new Set(mine.map((l) => l.player.country)).size;
  const orgs = new Set(mine.map((l) => l.roster.org)).size;
  const years = mine.map((l) => l.roster.year);
  return (
    <>
      <p className="chem-sum">
        <b>{word}</b>
        <span className="pips" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= pips ? 'on' : ''} />)}</span>
        <small>{good} link{good === 1 ? '' : 's'}{bad ? `, ${bad} penalty` : ''}</small>
      </p>
      <ul className="chem-facts" aria-label="Your team in numbers">
        <li><small>Main roles</small><b>{mains}<i>/5</i></b></li>
        <li><small>Nationalities</small><b>{nations}</b></li>
        <li><small>Organizations</small><b>{orgs}</b></li>
        <li><small>Years</small><b>{Math.min(...years)}{Math.max(...years) !== Math.min(...years) && <>–{String(Math.max(...years)).slice(2)}</>}</b></li>
      </ul>
    </>
  );
}

/** The team you're drafting against in a duel. */
function Challenger({ s }: { s: Run }) {
  const d = s.duel!;
  const lineup = challengerLineup(d);
  return (
    <div className="challenger">
      <small>Your opponent: {d.name}'s team, best of three</small>
      <ul>{lineup.map((l) => <li key={l.player.id}><RoleIcon role={l.slot} size={12} /> {l.player.nick} <span className="muted">{l.roster.org} {l.roster.year}</span></li>)}</ul>
      {d.coach && <span className="muted small">Coach {d.coach}</span>}
    </div>
  );
}

/** The coach and the bench player, under the five starters. */
export function Staff({ s, stats }: { s: Run; stats?: Record<string, { k: number; d: number; rating: number }> }) {
  const bench = benchLineup(s);
  const from = s.coachFrom ? G.rosterById.get(s.coachFrom) : undefined;
  if (!s.coach && !bench) return null;
  const st = bench ? stats?.[bench.player.id] : undefined;
  return (
    <ul className="lobby lobby--staff">
      {s.coach && (
        <li className="lobby__row">
          <span className="lobby__avatar lobby__avatar--coach">{from ? <TeamBadge roster={from} size={30} /> : 'C'}</span>
          <span className="lobby__who"><strong>{s.coach}</strong><small>{from ? `Coach of ${from.org} ${from.year}` : 'Coach'}</small></span>
          <span className="lobby__slot">Coach</span>
        </li>
      )}
      {bench && (
        <li className="lobby__row">
          <span className="lobby__avatar"><Avatar player={bench.player} roster={bench.roster} /></span>
          <span className="lobby__who"><strong>{bench.player.nick}</strong><small><TeamBadge roster={bench.roster} size={14} /> {bench.roster.org} {bench.roster.year}</small></span>
          <span className="lobby__slot"><RoleIcon role={bench.player.roles[0]} size={14} /> Bench</span>
          {st && <span className="lobby__stat"><small>{st.k}–{st.d}</small><b className={ratingClass(st.rating)}>{fmt(st.rating)}<RatingMark r={st.rating} /></b></span>}
        </li>
      )}
    </ul>
  );
}

/** The five starters as a lineup of portrait cards: the face large, the role as a tag on it, the name and team beneath. */
function LineupCards({ mine }: { mine: G.Lineup[] }) {
  return (
    <ol className="lineup" aria-label="Your starting five">
      {mine.map((l, i) => {
        const main = l.player.roles[0] === l.slot;
        return (
          <li key={l.player.id} className="lc anim-in" style={{ ['--team' as string]: l.roster.color, animationDelay: `${i * 70}ms` }}>
            <span className="lc__photo"><Avatar player={l.player} roster={l.roster} /></span>
            <span className="lc__tags">
              <span className="lc__role" title={main ? 'Main role' : 'Playing an off-role (small penalty)'}><RoleIcon role={l.slot} size={14} /> {ROLE_LABEL[l.slot]}</span>
              {!main && <i className="lc__off">Off-role</i>}
            </span>
            <span className="lc__body">
              <strong>{l.player.nick}</strong>
              <small><TeamBadge roster={l.roster} size={16} /> {l.roster.org} {l.roster.year}</small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The coach and the bench player: two wider, quieter cards under the five. */
function StaffCards({ s }: { s: Run }) {
  const bench = benchLineup(s);
  const from = s.coachFrom ? G.rosterById.get(s.coachFrom) : undefined;
  if (!s.coach && !bench) return null;
  return (
    <ul className="staff" aria-label="Coach and bench">
      {s.coach && (
        <li className="staff__card" style={{ ['--team' as string]: from?.color ?? 'var(--accent)' }}>
          <span className="staff__face staff__face--coach">{from ? <TeamBadge roster={from} size={34} /> : 'C'}</span>
          <span className="staff__who"><strong>{s.coach}</strong><small>{from ? `Coach of ${from.org} ${from.year}` : 'Coach'}</small></span>
          <span className="staff__tag">Coach</span>
        </li>
      )}
      {bench && (
        <li className="staff__card" style={{ ['--team' as string]: bench.roster.color }}>
          <span className="staff__face"><Avatar player={bench.player} roster={bench.roster} /></span>
          <span className="staff__who"><strong>{bench.player.nick}</strong><small><TeamBadge roster={bench.roster} size={14} /> {bench.roster.org} {bench.roster.year}</small></span>
          <span className="staff__tag"><RoleIcon role={bench.player.roles[0]} size={13} /> Bench</span>
        </li>
      )}
    </ul>
  );
}

export function ReadyScreen({ mine, s, dispatch }: { mine: G.Lineup[]; s: Run; dispatch: React.Dispatch<Action> }) {
  const offRoles = mine.filter((x) => x.player.roles[0] !== x.slot).length;
  const power = G.teamPower(mine, s.coach);
  return (
    <div className="stack lobby-page">
      <LineupCards mine={mine} />
      <StaffCards s={s} />
      <div className="lobby-mid">
        <section className="lpanel" aria-labelledby="chem-h">
          <h4 id="chem-h">Team chemistry <small>{offRoles === 0 ? 'Everyone is on their main role.' : `${offRoles} player${offRoles > 1 ? 's are' : ' is'} off their main role, which costs a little.`}</small></h4>
          <ChemistrySummary mine={mine} links={power.synergies} />
          <SynergyList list={power.synergies} detail={(x) => linkDetail(x, mine)} />
        </section>
        <MapComfort mine={mine} />
      </div>
      {s.duel && <Challenger s={s} />}
      <ArrivalFocus selector=".action-bar .cta" />
      <div className="lobby-go">
        {!s.duel && <p className="muted small">Swiss stage: three wins to reach the playoffs, three losses and you're out. Matches that can send you through or out are best of three, like the quarterfinal, semifinal and grand final.{s.bench ? ' Before each match, check everyone\'s form: you can sub your bench player in.' : ''}</p>}
        <div className="action-bar"><button className="cta cta--go" data-sfx="accept" onClick={() => dispatch({ type: 'play' })}>{s.duel ? 'Play the showmatch' : 'Find match'}</button></div>
      </div>
    </div>
  );
}

/**
 * Which maps your five are at home on, before the first veto (#49), so the veto isn't a surprise. The same comfort the veto panel compares with the
 * opponent's, shown as pips and a word; the opponent's comfort still decides who has the edge, so this is half of the picture.
 */
function MapComfort({ mine }: { mine: G.Lineup[] }) {
  const maps = mapComfort(mine);
  return (
    <section className="comfort" aria-labelledby="comfort-h">
      <h4 id="comfort-h">Your maps <small>Where your five are most at home. Your opponent's comfort decides the veto too.</small></h4>
      <ul>
        {maps.map((x) => (
          <li key={x.map} className={`comfort--${x.word}`}>
            <b>{x.map}</b>
            <span className="comfort__pips" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= x.pips ? 'on' : ''} />)}</span>
            <span>{x.word}<Sr>: {x.pips} of 5</Sr></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
