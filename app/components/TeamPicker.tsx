"use client";

import { useState } from "react";
import { worldCup2026Teams, type WorldCupTeam } from "../lib/teams";

interface TeamPickerProps {
  onStart: (offense: WorldCupTeam, defense: WorldCupTeam) => void;
}

export default function TeamPicker({ onStart }: TeamPickerProps) {
  const [search, setSearch] = useState("");

  const filtered = worldCup2026Teams.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.code.toLowerCase().includes(search.toLowerCase())
  );

  const handlePick = (team: WorldCupTeam) => {
    // Pick random opponent (different from chosen team)
    const others = worldCup2026Teams.filter(t => t.code !== team.code);
    const opponent = others[Math.floor(Math.random() * others.length)];
    onStart(team, opponent);
  };

  return (
    <div className="picker-overlay">
      <div className="picker-card">
        <div className="picker-header">
          <div className="picker-header-left">
            <span className="picker-icon">{"\u26BD"}</span>
            <span className="picker-title">SoccerPro</span>
          </div>
          <span className="picker-sub">World Cup 2026</span>
        </div>

        <div className="picker-prompt">Choose your team</div>

        <div className="picker-search">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="picker-grid">
          {filtered.map(team => (
            <button
              key={team.code}
              className="team-card"
              onClick={() => handlePick(team)}
            >
              <span className="team-flag">{team.flag}</span>
              <span className="team-name">{team.name}</span>
              <span className="team-code">{team.code}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
