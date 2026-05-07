export interface WorldCupTeam {
  name: string;
  code: string;
  primaryColor: string;
  secondaryColor: string;
  flag: string;
  flagImg: string;
}

// Flag images from flagcdn.com (public, free, no API key needed)
const f = (iso: string) => `https://flagcdn.com/w80/${iso}.png`;

export const worldCup2026Teams: WorldCupTeam[] = [
  // CONCACAF — Hosts + qualified
  { name: "United States", code: "USA", primaryColor: "#002868", secondaryColor: "#FFFFFF", flag: "🇺🇸", flagImg: f("us") },
  { name: "Mexico", code: "MEX", primaryColor: "#006847", secondaryColor: "#FFFFFF", flag: "🇲🇽", flagImg: f("mx") },
  { name: "Canada", code: "CAN", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", flag: "🇨🇦", flagImg: f("ca") },
  { name: "Panama", code: "PAN", primaryColor: "#DA121A", secondaryColor: "#FFFFFF", flag: "🇵🇦", flagImg: f("pa") },
  { name: "Haiti", code: "HAI", primaryColor: "#00209F", secondaryColor: "#D21034", flag: "🇭🇹", flagImg: f("ht") },
  { name: "Curaçao", code: "CUW", primaryColor: "#002B7F", secondaryColor: "#F9E814", flag: "🇨🇼", flagImg: f("cw") },

  // UEFA
  { name: "England", code: "ENG", primaryColor: "#FFFFFF", secondaryColor: "#CF091F", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", flagImg: f("gb-eng") },
  { name: "France", code: "FRA", primaryColor: "#002395", secondaryColor: "#FFFFFF", flag: "🇫🇷", flagImg: f("fr") },
  { name: "Spain", code: "ESP", primaryColor: "#AA151B", secondaryColor: "#F1BF00", flag: "🇪🇸", flagImg: f("es") },
  { name: "Germany", code: "GER", primaryColor: "#FFFFFF", secondaryColor: "#000000", flag: "🇩🇪", flagImg: f("de") },
  { name: "Portugal", code: "POR", primaryColor: "#DA291C", secondaryColor: "#006600", flag: "🇵🇹", flagImg: f("pt") },
  { name: "Netherlands", code: "NED", primaryColor: "#FF6600", secondaryColor: "#FFFFFF", flag: "🇳🇱", flagImg: f("nl") },
  { name: "Belgium", code: "BEL", primaryColor: "#ED2939", secondaryColor: "#000000", flag: "🇧🇪", flagImg: f("be") },
  { name: "Croatia", code: "CRO", primaryColor: "#FFFFFF", secondaryColor: "#FF0000", flag: "🇭🇷", flagImg: f("hr") },
  { name: "Switzerland", code: "SUI", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", flag: "🇨🇭", flagImg: f("ch") },
  { name: "Austria", code: "AUT", primaryColor: "#ED2939", secondaryColor: "#FFFFFF", flag: "🇦🇹", flagImg: f("at") },
  { name: "Scotland", code: "SCO", primaryColor: "#003087", secondaryColor: "#FFFFFF", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", flagImg: f("gb-sct") },
  { name: "Norway", code: "NOR", primaryColor: "#EF2B2D", secondaryColor: "#FFFFFF", flag: "🇳🇴", flagImg: f("no") },
  { name: "Sweden", code: "SWE", primaryColor: "#FECC02", secondaryColor: "#006AA7", flag: "🇸🇪", flagImg: f("se") },
  { name: "Türkiye", code: "TUR", primaryColor: "#E30A17", secondaryColor: "#FFFFFF", flag: "🇹🇷", flagImg: f("tr") },
  { name: "Czechia", code: "CZE", primaryColor: "#FFFFFF", secondaryColor: "#D7141A", flag: "🇨🇿", flagImg: f("cz") },
  { name: "Bosnia & Herzegovina", code: "BIH", primaryColor: "#002395", secondaryColor: "#FECB00", flag: "🇧🇦", flagImg: f("ba") },

  // CONMEBOL
  { name: "Argentina", code: "ARG", primaryColor: "#75AADB", secondaryColor: "#FFFFFF", flag: "🇦🇷", flagImg: f("ar") },
  { name: "Brazil", code: "BRA", primaryColor: "#FFDF00", secondaryColor: "#009739", flag: "🇧🇷", flagImg: f("br") },
  { name: "Uruguay", code: "URU", primaryColor: "#5CBFEB", secondaryColor: "#FFFFFF", flag: "🇺🇾", flagImg: f("uy") },
  { name: "Colombia", code: "COL", primaryColor: "#FCD116", secondaryColor: "#003893", flag: "🇨🇴", flagImg: f("co") },
  { name: "Ecuador", code: "ECU", primaryColor: "#FFD100", secondaryColor: "#003DA5", flag: "🇪🇨", flagImg: f("ec") },
  { name: "Paraguay", code: "PAR", primaryColor: "#DA121A", secondaryColor: "#FFFFFF", flag: "🇵🇾", flagImg: f("py") },

  // AFC
  { name: "Japan", code: "JPN", primaryColor: "#000080", secondaryColor: "#FFFFFF", flag: "🇯🇵", flagImg: f("jp") },
  { name: "South Korea", code: "KOR", primaryColor: "#CD2E3A", secondaryColor: "#FFFFFF", flag: "🇰🇷", flagImg: f("kr") },
  { name: "Australia", code: "AUS", primaryColor: "#FFB200", secondaryColor: "#003F23", flag: "🇦🇺", flagImg: f("au") },
  { name: "Saudi Arabia", code: "KSA", primaryColor: "#006C35", secondaryColor: "#FFFFFF", flag: "🇸🇦", flagImg: f("sa") },
  { name: "Iran", code: "IRN", primaryColor: "#FFFFFF", secondaryColor: "#DA0000", flag: "🇮🇷", flagImg: f("ir") },
  { name: "Qatar", code: "QAT", primaryColor: "#8D1B3D", secondaryColor: "#FFFFFF", flag: "🇶🇦", flagImg: f("qa") },
  { name: "Iraq", code: "IRQ", primaryColor: "#007A33", secondaryColor: "#FFFFFF", flag: "🇮🇶", flagImg: f("iq") },
  { name: "Uzbekistan", code: "UZB", primaryColor: "#FFFFFF", secondaryColor: "#0099DD", flag: "🇺🇿", flagImg: f("uz") },
  { name: "Jordan", code: "JOR", primaryColor: "#FFFFFF", secondaryColor: "#007A3D", flag: "🇯🇴", flagImg: f("jo") },

  // CAF
  { name: "Morocco", code: "MAR", primaryColor: "#C1272D", secondaryColor: "#006233", flag: "🇲🇦", flagImg: f("ma") },
  { name: "Senegal", code: "SEN", primaryColor: "#FFFFFF", secondaryColor: "#00853F", flag: "🇸🇳", flagImg: f("sn") },
  { name: "Egypt", code: "EGY", primaryColor: "#C8102E", secondaryColor: "#FFFFFF", flag: "🇪🇬", flagImg: f("eg") },
  { name: "Algeria", code: "ALG", primaryColor: "#006233", secondaryColor: "#FFFFFF", flag: "🇩🇿", flagImg: f("dz") },
  { name: "South Africa", code: "RSA", primaryColor: "#FFB81C", secondaryColor: "#007749", flag: "🇿🇦", flagImg: f("za") },
  { name: "Tunisia", code: "TUN", primaryColor: "#CE1126", secondaryColor: "#FFFFFF", flag: "🇹🇳", flagImg: f("tn") },
  { name: "Côte d'Ivoire", code: "CIV", primaryColor: "#FF8200", secondaryColor: "#009A44", flag: "🇨🇮", flagImg: f("ci") },
  { name: "Ghana", code: "GHA", primaryColor: "#FFFFFF", secondaryColor: "#006B3F", flag: "🇬🇭", flagImg: f("gh") },
  { name: "Cape Verde", code: "CPV", primaryColor: "#003893", secondaryColor: "#CF2028", flag: "🇨🇻", flagImg: f("cv") },
  { name: "DR Congo", code: "COD", primaryColor: "#007FFF", secondaryColor: "#CE1021", flag: "🇨🇩", flagImg: f("cd") },

  // OFC
  { name: "New Zealand", code: "NZL", primaryColor: "#FFFFFF", secondaryColor: "#000000", flag: "🇳🇿", flagImg: f("nz") },
];
