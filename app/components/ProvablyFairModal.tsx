"use client";

import { useState } from "react";

interface ProvablyFairModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProvablyFairModal({ open, onClose }: ProvablyFairModalProps) {
  const [activeTab, setActiveTab] = useState<"seeds" | "verify">("seeds");
  const [clientSeed, setClientSeed] = useState(() => "arena_" + Math.random().toString(36).slice(2, 10));
  const serverHash = "a1f3e4b2c8d9f07654321abcdef0123456789abcdef0123456789abcdef012345";
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleRegen = () => {
    setClientSeed("arena_" + Math.random().toString(36).slice(2, 10));
  };

  return (
    <div
      className={`modal-overlay${open ? " show" : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>Provably Fair</h2>
        <p className="pf-desc">
          SoccerPro uses <strong>Provably Fair</strong> technology. Every round outcome
          is predetermined cryptographically before you bet. You can verify that no manipulation occurred.
        </p>

        <div className="pf-toggle-row">
          <button
            className={`pf-toggle-btn${activeTab === "seeds" ? " active" : ""}`}
            onClick={() => setActiveTab("seeds")}
          >
            Seeds
          </button>
          <button
            className={`pf-toggle-btn${activeTab === "verify" ? " active" : ""}`}
            onClick={() => setActiveTab("verify")}
          >
            Verify
          </button>
        </div>

        {activeTab === "seeds" && (
          <>
            <div className="pf-section">
              <div className="pf-label">
                <span className="pf-icon">{"\uD83D\uDDA5"}</span> Client Seed
              </div>
              <div className="pf-sublabel">Generated on your side — you control this</div>
              <div className="pf-input-row">
                <input
                  type="text"
                  value={clientSeed}
                  onChange={(e) => setClientSeed(e.target.value)}
                />
                <button
                  className="pf-btn-sm"
                  title="Copy"
                  onClick={() => handleCopy(clientSeed, "client")}
                >
                  {copied === "client" ? "\u2713" : "CP"}
                </button>
                <button className="pf-btn-sm" title="Regenerate" onClick={handleRegen}>
                  R
                </button>
              </div>
            </div>

            <div className="pf-section">
              <div className="pf-label">
                <span className="pf-icon">{"\uD83D\uDD12"}</span> Server Seed SHA256
              </div>
              <div className="pf-sublabel">Committed before you bet — revealed after</div>
              <div className="pf-hash-box">{serverHash}</div>
              <div className="pf-cp-row">
                <button
                  className="pf-btn-sm"
                  title="Copy"
                  onClick={() => handleCopy(serverHash, "hash")}
                >
                  {copied === "hash" ? "\u2713" : "CP"}
                </button>
              </div>
              <p className="pf-note">
                This hash is committed <strong>before</strong> you bet. After the game,
                the server seed is revealed so you can verify SHA256(seed) matches.
              </p>
            </div>
          </>
        )}

        {activeTab === "verify" && (
          <div className="pf-how">
            <div className="pf-how-title">How SoccerPro Provably Fair Works</div>
            <ol>
              <li>Server generates a secret seed and shows you its SHA256 hash</li>
              <li>You set your client seed (your influence on the randomness)</li>
              <li>You configure your formation and place a bet</li>
              <li>
                Result = HMAC-SHA256(server_seed, client_seed:nonce) mapped to a
                win/lose outcome based on your formation{"'"}s win probability
              </li>
              <li>The match animation plays out, biased toward the predetermined result</li>
              <li>Server reveals the seed — verify SHA256 matches the pre-committed hash</li>
              <li>New seed is pre-generated for the next round</li>
            </ol>
            <p className="pf-note" style={{ marginTop: 12 }}>
              The visual simulation is a representation of the outcome. The actual result is determined
              cryptographically before the animation begins — ensuring the game cannot be manipulated
              mid-round.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
