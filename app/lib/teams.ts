export interface WorldCupTeam {
  name: string;
  code: string;
  primaryColor: string;
  secondaryColor: string;
  flag: string;
}

export const worldCup2026Teams: WorldCupTeam[] = [
  // CONCACAF — Hosts + qualified
  { name: "United States", code: "USA", primaryColor: "#002868", secondaryColor: "#FFFFFF", flag: "🇺🇸" },
  { name: "Mexico", code: "MEX", primaryColor: "#006847", secondaryColor: "#FFFFFF", flag: "🇲🇽" },
  { name: "Canada", code: "CAN", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", flag: "🇨🇦" },
  { name: "Panama", code: "PAN", primaryColor: "#DA121A", secondaryColor: "#FFFFFF", flag: "🇵🇦" },
  { name: "Haiti", code: "HAI", primaryColor: "#00209F", secondaryColor: "#D21034", flag: "🇭🇹" },
  { name: "Curaçao", code: "CUW", primaryColor: "#002B7F", secondaryColor: "#F9E814", flag: "🇨🇼" },

  // UEFA
  { name: "England", code: "ENG", primaryColor: "#FFFFFF", secondaryColor: "#CF091F", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "France", code: "FRA", primaryColor: "#002395", secondaryColor: "#FFFFFF", flag: "🇫🇷" },
  { name: "Spain", code: "ESP", primaryColor: "#AA151B", secondaryColor: "#F1BF00", flag: "🇪🇸" },
  { name: "Germany", code: "GER", primaryColor: "#FFFFFF", secondaryColor: "#000000", flag: "🇩🇪" },
  { name: "Portugal", code: "POR", primaryColor: "#DA291C", secondaryColor: "#006600", flag: "🇵🇹" },
  { name: "Netherlands", code: "NED", primaryColor: "#FF6600", secondaryColor: "#FFFFFF", flag: "🇳🇱" },
  { name: "Belgium", code: "BEL", primaryColor: "#ED2939", secondaryColor: "#000000", flag: "🇧🇪" },
  { name: "Croatia", code: "CRO", primaryColor: "#FFFFFF", secondaryColor: "#FF0000", flag: "🇭🇷" },
  { name: "Switzerland", code: "SUI", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", flag: "🇨🇭" },
  { name: "Austria", code: "AUT", primaryColor: "#ED2939", secondaryColor: "#FFFFFF", flag: "🇦🇹" },
  { name: "Scotland", code: "SCO", primaryColor: "#003087", secondaryColor: "#FFFFFF", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Norway", code: "NOR", primaryColor: "#EF2B2D", secondaryColor: "#FFFFFF", flag: "🇳🇴" },
  { name: "Sweden", code: "SWE", primaryColor: "#FECC02", secondaryColor: "#006AA7", flag: "🇸🇪" },
  { name: "Türkiye", code: "TUR", primaryColor: "#E30A17", secondaryColor: "#FFFFFF", flag: "🇹🇷" },
  { name: "Czechia", code: "CZE", primaryColor: "#FFFFFF", secondaryColor: "#D7141A", flag: "🇨🇿" },
  { name: "Bosnia & Herzegovina", code: "BIH", primaryColor: "#002395", secondaryColor: "#FECB00", flag: "🇧🇦" },

  // CONMEBOL
  { name: "Argentina", code: "ARG", primaryColor: "#75AADB", secondaryColor: "#FFFFFF", flag: "🇦🇷" },
  { name: "Brazil", code: "BRA", primaryColor: "#FFDF00", secondaryColor: "#009739", flag: "🇧🇷" },
  { name: "Uruguay", code: "URU", primaryColor: "#5CBFEB", secondaryColor: "#FFFFFF", flag: "🇺🇾" },
  { name: "Colombia", code: "COL", primaryColor: "#FCD116", secondaryColor: "#003893", flag: "🇨🇴" },
  { name: "Ecuador", code: "ECU", primaryColor: "#FFD100", secondaryColor: "#003DA5", flag: "🇪🇨" },
  { name: "Paraguay", code: "PAR", primaryColor: "#DA121A", secondaryColor: "#FFFFFF", flag: "🇵🇾" },

  // AFC
  { name: "Japan", code: "JPN", primaryColor: "#000080", secondaryColor: "#FFFFFF", flag: "🇯🇵" },
  { name: "South Korea", code: "KOR", primaryColor: "#CD2E3A", secondaryColor: "#FFFFFF", flag: "🇰🇷" },
  { name: "Australia", code: "AUS", primaryColor: "#FFB200", secondaryColor: "#003F23", flag: "🇦🇺" },
  { name: "Saudi Arabia", code: "KSA", primaryColor: "#006C35", secondaryColor: "#FFFFFF", flag: "🇸🇦" },
  { name: "Iran", code: "IRN", primaryColor: "#FFFFFF", secondaryColor: "#DA0000", flag: "🇮🇷" },
  { name: "Qatar", code: "QAT", primaryColor: "#8D1B3D", secondaryColor: "#FFFFFF", flag: "🇶🇦" },
  { name: "Iraq", code: "IRQ", primaryColor: "#007A33", secondaryColor: "#FFFFFF", flag: "🇮🇶" },
  { name: "Uzbekistan", code: "UZB", primaryColor: "#FFFFFF", secondaryColor: "#0099DD", flag: "🇺🇿" },
  { name: "Jordan", code: "JOR", primaryColor: "#FFFFFF", secondaryColor: "#007A3D", flag: "🇯🇴" },

  // CAF
  { name: "Morocco", code: "MAR", primaryColor: "#C1272D", secondaryColor: "#006233", flag: "🇲🇦" },
  { name: "Senegal", code: "SEN", primaryColor: "#FFFFFF", secondaryColor: "#00853F", flag: "🇸🇳" },
  { name: "Egypt", code: "EGY", primaryColor: "#C8102E", secondaryColor: "#FFFFFF", flag: "🇪🇬" },
  { name: "Algeria", code: "ALG", primaryColor: "#006233", secondaryColor: "#FFFFFF", flag: "🇩🇿" },
  { name: "South Africa", code: "RSA", primaryColor: "#FFB81C", secondaryColor: "#007749", flag: "🇿🇦" },
  { name: "Tunisia", code: "TUN", primaryColor: "#CE1126", secondaryColor: "#FFFFFF", flag: "🇹🇳" },
  { name: "Côte d'Ivoire", code: "CIV", primaryColor: "#FF8200", secondaryColor: "#009A44", flag: "🇨🇮" },
  { name: "Ghana", code: "GHA", primaryColor: "#FFFFFF", secondaryColor: "#006B3F", flag: "🇬🇭" },
  { name: "Cape Verde", code: "CPV", primaryColor: "#003893", secondaryColor: "#CF2028", flag: "🇨🇻" },
  { name: "DR Congo", code: "COD", primaryColor: "#007FFF", secondaryColor: "#CE1021", flag: "🇨🇩" },

  // OFC
  { name: "New Zealand", code: "NZL", primaryColor: "#FFFFFF", secondaryColor: "#000000", flag: "🇳🇿" },
];
