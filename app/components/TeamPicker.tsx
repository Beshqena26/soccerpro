"use client";

import { useState } from "react";
import { worldCup2026Teams, type WorldCupTeam } from "../lib/teams";

interface TeamPickerProps {
  onStart: (offense: WorldCupTeam, defense: WorldCupTeam) => void;
}

export default function TeamPicker({ onStart }: TeamPickerProps) {
  const [step, setStep] = useState<"offense" | "defense">("offense");
  const [offenseTeam, setOffenseTeam] = useState<WorldCupTeam | null>(null);
  const [search, setSearch] = useState("");

  const filtered = worldCup2026Teams.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.code.toLowerCase().includes(search.toLowerCase())
  );

  const handlePick = (team: WorldCupTeam) => {
    if (step === "offense") {
      setOffenseTeam(team);
      setStep("defense");
      setSearch("");
    } else {
      if (offenseTeam) onStart(offenseTeam, team);
    }
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

        {offenseTeam && step === "defense" && (
          <div className="picked-badge" onClick={() => { setStep("offense"); setOffenseTeam(null); setSearch(""); }}>
            <span className="picked-flag">{offenseTeam.flag}</span>
            <span className="picked-name">{offenseTeam.name}</span>
            <span className="picked-vs">VS ?</span>
          </div>
        )}

        <div className="picker-prompt">
          {step === "offense" ? "Select your team" : "Select opponent"}
        </div>

        <div className="picker-search">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="picker-grid">
          {filtered.map(team => {
            const isSelected = offenseTeam?.code === team.code && step === "defense";
            return (
              <button
                key={team.code}
                className={`team-card${isSelected ? " disabled" : ""}`}
                onClick={() => !isSelected && handlePick(team)}
                disabled={isSelected}
              >
                <span className="team-flag">{team.flag}</span>
                <span className="team-name">{team.name}</span>
                <span className="team-code">{team.code}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
