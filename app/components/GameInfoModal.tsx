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
          <span className="label">Max Multiplier</span>
          <span className="value">48.25x</span>
        </div>
        <div className="modal-payout-box">
          <span className="label">Max Win</span>
          <span className="value">$24,125</span>
        </div>
        <div className="modal-payout-box">
          <span className="label">Bet Range</span>
          <span className="value">$1.00 — $500.00</span>
        </div>

        <div className="info-box">
          <span className="info-icon">{"\u26BD"}</span>
          <p>
            SoccerPro is a casino multiplier game. Set your offense vs defense formation,
            place a bet, and watch the match play out. Your attackers try to score — if they do, you win!
          </p>
        </div>

        <h3>How to Play</h3>
        <ol>
          <li>
            <strong>Set your formation</strong> — choose how many attackers (1-9) and defenders (1-9).
            More defenders = harder to score = higher multiplier.
          </li>
          <li>
            <strong>Place your bet</strong> — enter the amount you want to wager ($1-$500).
          </li>
          <li>
            <strong>Kick Off</strong> — your attackers try to score against the defenders.
          </li>
          <li>
            <strong style={{ color: "#0ECC68" }}>Win</strong> — if your offense scores a goal
            at the top, you win bet × multiplier.
          </li>
          <li>
            <strong style={{ color: "#ED4163" }}>Lose</strong> — if the defense tackles and
            counter-attacks to score at the bottom, you lose your bet.
          </li>
        </ol>

        <h3>Multiplier Table</h3>
        <div className="mult-table-wrap">
          <table className="mult-table">
            <tbody>
              <tr>
                <th>Formation</th>
                <th>Multiplier</th>
                <th>Win Chance</th>
              </tr>
              <tr><td>5 OFF vs 1 DEF</td><td>1.05x</td><td>92%</td></tr>
              <tr><td>5 OFF vs 3 DEF</td><td>1.42x</td><td>68%</td></tr>
              <tr><td>5 OFF vs 5 DEF</td><td>1.75x</td><td>55%</td></tr>
              <tr><td>3 OFF vs 5 DEF</td><td>2.41x</td><td>40%</td></tr>
              <tr><td>2 OFF vs 5 DEF</td><td>3.45x</td><td>28%</td></tr>
              <tr><td>1 OFF vs 5 DEF</td><td>12.06x</td><td>8%</td></tr>
              <tr><td>1 OFF vs 7 DEF</td><td>27.57x</td><td>3.5%</td></tr>
              <tr><td>1 OFF vs 9 DEF</td><td>48.25x</td><td>2%</td></tr>
            </tbody>
          </table>
        </div>

        <h3>Game Mechanics</h3>
        <ul>
          <li>Offense attacks toward the <strong>top goal</strong> (green net).</li>
          <li>Defense guards the top goal and can <strong>counter-attack</strong> toward the bottom goal (red net).</li>
          <li>After a tackle, the defender grabs the ball and runs toward your goal.</li>
          <li>The multiplier is based on the ratio of defenders to attackers.</li>
          <li>Each round is independent — results don{"'"}t affect future rounds.</li>
          <li>Every outcome is provably fair — tap Fair Play to verify.</li>
        </ul>

        <h3>Tips</h3>
        <ul>
          <li>More attackers = easier to score but lower payout.</li>
          <li>More defenders = harder to score but massive multiplier.</li>
          <li>Try 2v5 or 3v7 for a good risk/reward balance.</li>
          <li>Watch the counter-attack — that{"'"}s how you lose!</li>
        </ul>
      </div>
    </div>
  );
}
