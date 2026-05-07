"use client";

interface GameInfoModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GameInfoModal({ open, onClose }: GameInfoModalProps) {
  return (
    <div
      className={`modal-overlay${open ? " show" : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>Game Info</h2>

        <div className="modal-payout-box">
          <span className="label">RTP</span>
          <span className="value">96.5%</span>
        </div>
        <div className="modal-payout-box">
          <span className="label">House Edge</span>
          <span className="value">3.5%</span>
        </div>
        <div className="modal-payout-box">
          <span className="label">Bet Range</span>
          <span className="value">$1.00 — $500.00</span>
        </div>

        <div className="info-box">
          <span className="info-icon">{"\u26BD"}</span>
          <p>
            SoccerPro is a football match betting game. Pick your team, set your formation,
            place a bet, and watch a full match play out with 2 halves and extra time if needed.
            If your team wins, you get paid!
          </p>
        </div>

        <h3>How to Play</h3>
        <ol>
          <li>
            <strong>Choose your team</strong> — pick from 48 World Cup 2026 nations. Your opponent is randomly selected.
          </li>
          <li>
            <strong>Set your formation</strong> — choose attackers (1-9) and defenders (1-9).
            More defenders = harder to win = higher multiplier.
          </li>
          <li>
            <strong>Place your bet</strong> — enter your wager ($1-$500). Use the  ½, 2x, or Max buttons for quick adjustments.
          </li>
          <li>
            <strong>Pick game speed</strong> — Standard for normal pace, Fast for 2x speed.
          </li>
          <li>
            <strong>Kick Off</strong> — watch the match unfold!
          </li>
        </ol>

        <h3>Match Structure</h3>
        <ul>
          <li><strong>1st Half</strong> — both teams play, goals can be scored by either side.</li>
          <li><strong>Half Time</strong> — brief pause showing the current score.</li>
          <li><strong>2nd Half</strong> — play continues, more goals possible.</li>
          <li><strong>Full Time</strong> — if one team is ahead, match ends.</li>
          <li><strong>Extra Time</strong> — if the score is tied (e.g. 1-1, 2-2), extra time is played. <strong>Golden goal</strong> — first team to score wins!</li>
        </ul>

        <h3>Scoring</h3>
        <ul>
          <li>Your attackers shoot at the <strong>top goal</strong>.</li>
          <li>Defenders can counter-attack toward the <strong>bottom goal</strong>.</li>
          <li>Multiple goals per half are possible (0-0, 1-0, 1-1, 2-1, etc.).</li>
          <li>Goalkeepers can save shots — they{"'"}re not guaranteed goals.</li>
          <li>Long-range shots can happen from outside the box.</li>
        </ul>

        <h3>Win / Lose</h3>
        <ul>
          <li>
            <strong style={{ color: "#0ECC68" }}>Win</strong> — your team scores more goals. You receive bet x multiplier.
          </li>
          <li>
            <strong style={{ color: "#ED4163" }}>Lose</strong> — the opponent scores more. You lose your bet.
          </li>
        </ul>

        <h3>Multiplier & Win Chance</h3>
        <ul>
          <li>Every unique attacker/defender combination has a <strong>unique multiplier</strong>.</li>
          <li>More attackers = higher win chance, lower payout.</li>
          <li>More defenders = lower win chance, higher payout.</li>
          <li>Multiplier = (1 - house edge) / win chance. Displayed in the bet modal.</li>
        </ul>

        <h3>Tips</h3>
        <ul>
          <li>Try different formations — 3v5 gives a good risk/reward balance.</li>
          <li>Watch for counter-attacks after your team loses possession.</li>
          <li>Extra time is golden goal — one shot can decide everything.</li>
          <li>Use Fast mode for quicker games, Standard for the full experience.</li>
          <li>Every outcome is provably fair — tap Fair Play to verify.</li>
        </ul>
      </div>
    </div>
  );
}
