export interface WorldCupTeam {
  name: string;
  code: string;
  primaryColor: string;
  secondaryColor: string;
  flag: string;
  flagImg: string;    // circle flag for players
  flagRect: string;   // rectangular flag for penalty areas
}

// Circle flag SVGs for player circles
const f = (iso: string) => `https://hatscripts.github.io/circle-flags/flags/${iso}.svg`;
// Rectangular flag for penalty area backgrounds
const r = (iso: string) => `https://flagcdn.com/w320/${iso}.png`;

export const worldCup2026Teams: WorldCupTeam[] = [
  // CONCACAF — Hosts + qualified
  { name: "United States", code: "USA", primaryColor: "#002868", secondaryColor: "#FFFFFF", flag: "🇺🇸", flagImg: f("us"), flagRect: r("us") },
  { name: "Mexico", code: "MEX", primaryColor: "#006847", secondaryColor: "#FFFFFF", flag: "🇲🇽", flagImg: f("mx"), flagRect: r("mx") },
  { name: "Canada", code: "CAN", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", flag: "🇨🇦", flagImg: f("ca"), flagRect: r("ca") },
  { name: "Panama", code: "PAN", primaryColor: "#DA121A", secondaryColor: "#FFFFFF", flag: "🇵🇦", flagImg: f("pa"), flagRect: r("pa") },
  { name: "Haiti", code: "HAI", primaryColor: "#00209F", secondaryColor: "#D21034", flag: "🇭🇹", flagImg: f("ht"), flagRect: r("ht") },
  { name: "Curaçao", code: "CUW", primaryColor: "#002B7F", secondaryColor: "#F9E814", flag: "🇨🇼", flagImg: f("cw"), flagRect: r("cw") },

  // UEFA
  { name: "England", code: "ENG", primaryColor: "#FFFFFF", secondaryColor: "#CF091F", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", flagImg: f("gb"), flagRect: r("gb") },
  { name: "France", code: "FRA", primaryColor: "#002395", secondaryColor: "#FFFFFF", flag: "🇫🇷", flagImg: f("fr"), flagRect: r("fr") },
  { name: "Spain", code: "ESP", primaryColor: "#AA151B", secondaryColor: "#F1BF00", flag: "🇪🇸", flagImg: f("es"), flagRect: r("es") },
  { name: "Germany", code: "GER", primaryColor: "#FFFFFF", secondaryColor: "#000000", flag: "🇩🇪", flagImg: f("de"), flagRect: r("de") },
  { name: "Portugal", code: "POR", primaryColor: "#DA291C", secondaryColor: "#006600", flag: "🇵🇹", flagImg: f("pt"), flagRect: r("pt") },
  { name: "Netherlands", code: "NED", primaryColor: "#FF6600", secondaryColor: "#FFFFFF", flag: "🇳🇱", flagImg: f("nl"), flagRect: r("nl") },
  { name: "Belgium", code: "BEL", primaryColor: "#ED2939", secondaryColor: "#000000", flag: "🇧🇪", flagImg: f("be"), flagRect: r("be") },
  { name: "Croatia", code: "CRO", primaryColor: "#FFFFFF", secondaryColor: "#FF0000", flag: "🇭🇷", flagImg: f("hr"), flagRect: r("hr") },
  { name: "Switzerland", code: "SUI", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", flag: "🇨🇭", flagImg: f("ch"), flagRect: r("ch") },
  { name: "Austria", code: "AUT", primaryColor: "#ED2939", secondaryColor: "#FFFFFF", flag: "🇦🇹", flagImg: f("at"), flagRect: r("at") },
  { name: "Scotland", code: "SCO", primaryColor: "#003087", secondaryColor: "#FFFFFF", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", flagImg: f("gb"), flagRect: r("gb") },
  { name: "Norway", code: "NOR", primaryColor: "#EF2B2D", secondaryColor: "#FFFFFF", flag: "🇳🇴", flagImg: f("no"), flagRect: r("no") },
  { name: "Sweden", code: "SWE", primaryColor: "#FECC02", secondaryColor: "#006AA7", flag: "🇸🇪", flagImg: f("se"), flagRect: r("se") },
  { name: "Türkiye", code: "TUR", primaryColor: "#E30A17", secondaryColor: "#FFFFFF", flag: "🇹🇷", flagImg: f("tr"), flagRect: r("tr") },
  { name: "Czechia", code: "CZE", primaryColor: "#FFFFFF", secondaryColor: "#D7141A", flag: "🇨🇿", flagImg: f("cz"), flagRect: r("cz") },
  { name: "Bosnia & Herzegovina", code: "BIH", primaryColor: "#002395", secondaryColor: "#FECB00", flag: "🇧🇦", flagImg: f("ba"), flagRect: r("ba") },

  // CONMEBOL
  { name: "Argentina", code: "ARG", primaryColor: "#75AADB", secondaryColor: "#FFFFFF", flag: "🇦🇷", flagImg: f("ar"), flagRect: r("ar") },
  { name: "Brazil", code: "BRA", primaryColor: "#FFDF00", secondaryColor: "#009739", flag: "🇧🇷", flagImg: f("br"), flagRect: r("br") },
  { name: "Uruguay", code: "URU", primaryColor: "#5CBFEB", secondaryColor: "#FFFFFF", flag: "🇺🇾", flagImg: f("uy"), flagRect: r("uy") },
  { name: "Colombia", code: "COL", primaryColor: "#FCD116", secondaryColor: "#003893", flag: "🇨🇴", flagImg: f("co"), flagRect: r("co") },
  { name: "Ecuador", code: "ECU", primaryColor: "#FFD100", secondaryColor: "#003DA5", flag: "🇪🇨", flagImg: f("ec"), flagRect: r("ec") },
  { name: "Paraguay", code: "PAR", primaryColor: "#DA121A", secondaryColor: "#FFFFFF", flag: "🇵🇾", flagImg: f("py"), flagRect: r("py") },

  // AFC
  { name: "Japan", code: "JPN", primaryColor: "#000080", secondaryColor: "#FFFFFF", flag: "🇯🇵", flagImg: f("jp"), flagRect: r("jp") },
  { name: "South Korea", code: "KOR", primaryColor: "#CD2E3A", secondaryColor: "#FFFFFF", flag: "🇰🇷", flagImg: f("kr"), flagRect: r("kr") },
  { name: "Australia", code: "AUS", primaryColor: "#FFB200", secondaryColor: "#003F23", flag: "🇦🇺", flagImg: f("au"), flagRect: r("au") },
  { name: "Saudi Arabia", code: "KSA", primaryColor: "#006C35", secondaryColor: "#FFFFFF", flag: "🇸🇦", flagImg: f("sa"), flagRect: r("sa") },
  { name: "Iran", code: "IRN", primaryColor: "#FFFFFF", secondaryColor: "#DA0000", flag: "🇮🇷", flagImg: f("ir"), flagRect: r("ir") },
  { name: "Qatar", code: "QAT", primaryColor: "#8D1B3D", secondaryColor: "#FFFFFF", flag: "🇶🇦", flagImg: f("qa"), flagRect: r("qa") },
  { name: "Iraq", code: "IRQ", primaryColor: "#007A33", secondaryColor: "#FFFFFF", flag: "🇮🇶", flagImg: f("iq"), flagRect: r("iq") },
  { name: "Uzbekistan", code: "UZB", primaryColor: "#FFFFFF", secondaryColor: "#0099DD", flag: "🇺🇿", flagImg: f("uz"), flagRect: r("uz") },
  { name: "Jordan", code: "JOR", primaryColor: "#FFFFFF", secondaryColor: "#007A3D", flag: "🇯🇴", flagImg: f("jo"), flagRect: r("jo") },

  // CAF
  { name: "Morocco", code: "MAR", primaryColor: "#C1272D", secondaryColor: "#006233", flag: "🇲🇦", flagImg: f("ma"), flagRect: r("ma") },
  { name: "Senegal", code: "SEN", primaryColor: "#FFFFFF", secondaryColor: "#00853F", flag: "🇸🇳", flagImg: f("sn"), flagRect: r("sn") },
  { name: "Egypt", code: "EGY", primaryColor: "#C8102E", secondaryColor: "#FFFFFF", flag: "🇪🇬", flagImg: f("eg"), flagRect: r("eg") },
  { name: "Algeria", code: "ALG", primaryColor: "#006233", secondaryColor: "#FFFFFF", flag: "🇩🇿", flagImg: f("dz"), flagRect: r("dz") },
  { name: "South Africa", code: "RSA", primaryColor: "#FFB81C", secondaryColor: "#007749", flag: "🇿🇦", flagImg: f("za"), flagRect: r("za") },
  { name: "Tunisia", code: "TUN", primaryColor: "#CE1126", secondaryColor: "#FFFFFF", flag: "🇹🇳", flagImg: f("tn"), flagRect: r("tn") },
  { name: "Côte d'Ivoire", code: "CIV", primaryColor: "#FF8200", secondaryColor: "#009A44", flag: "🇨🇮", flagImg: f("ci"), flagRect: r("ci") },
  { name: "Ghana", code: "GHA", primaryColor: "#FFFFFF", secondaryColor: "#006B3F", flag: "🇬🇭", flagImg: f("gh"), flagRect: r("gh") },
  { name: "Cape Verde", code: "CPV", primaryColor: "#003893", secondaryColor: "#CF2028", flag: "🇨🇻", flagImg: f("cv"), flagRect: r("cv") },
  { name: "DR Congo", code: "COD", primaryColor: "#007FFF", secondaryColor: "#CE1021", flag: "🇨🇩", flagImg: f("cd"), flagRect: r("cd") },

  // OFC
  { name: "New Zealand", code: "NZL", primaryColor: "#FFFFFF", secondaryColor: "#000000", flag: "🇳🇿", flagImg: f("nz"), flagRect: r("nz") },
];
