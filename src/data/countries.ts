export interface CountryDetail {
  stats: { label: string; value: string }[];
  context: string;
}

export const COUNTRY_DETAILS: Record<string, CountryDetail> = {
  'Spain': {
    stats: [
      { label: 'IVF CAGR',          value: '8-9%' },
      { label: 'GDP Growth',         value: '2.5-3.0%' },
    ],
    context: 'Spain is Europe\'s leading IVF destination by cycle volume per capita, driven by a highly commercialised private-pay market and a liberal regulatory framework. Consolidated clinic networks - IVI and Quirónsalud - offer highly efficient B2B entry. Strong willingness to pay for premium add-on diagnostics makes this a Tier 1 priority for Genie\'s initial international expansion.',
  },
  'United Kingdom': {
    stats: [
      { label: 'IVF CAGR',          value: '6-8%' },
      { label: 'GDP Growth',         value: '1.0-2.0%' },
    ],
    context: 'The UK represents Genie\'s home market advantage - UKCA regulatory alignment, full data adequacy, and world-class KOL access at institutions like Guy\'s & St Thomas\' and CRGH. NHS constraints cap state-funded volume but the private sector is growing rapidly, with patients actively seeking premium diagnostics. An anchor market for clinical validation and reputational proof-of-concept.',
  },
  'Denmark': {
    stats: [
      { label: 'IVF CAGR',          value: '5-7%' },
      { label: 'GDP Growth',         value: '1.5-2.5%' },
    ],
    context: 'Denmark has the second highest IVF utilisation rate per capita globally, with a pioneering digital health culture and full LGBTQ+ access driving broad demand. The Rigshospitalet fertility unit is a world-renowned KOL hub whose endorsement carries global weight. Small absolute market size is offset by the reputational spillover of a successful Danish launch.',
  },
  'Australia': {
    stats: [
      { label: 'IVF CAGR',          value: '8-10%' },
      { label: 'GDP Growth',         value: '1.8-2.5%' },
    ],
    context: 'Australia\'s IVF market is dominated by a small number of large networks - Monash IVF and Virtus Health - creating an oligopolistic structure where a single commercial agreement can unlock a majority of national cycle volume. Strong innovation adoption culture and Medicare rebate structures support add-on diagnostic uptake. Operational distance from London is the primary challenge.',
  },
  'Germany': {
    stats: [
      { label: 'IVF CAGR',          value: '6-9%' },
      { label: 'GDP Growth',         value: '0.5-1.5%' },
    ],
    context: 'Germany\'s large absolute market and strong clinical infrastructure are significantly offset by restrictive embryo protection legislation (ESchG), limited LGBTQ+ access, and a strong preference for domestically validated technology. Regulatory complexity for AI-based SaMD is high. A meaningful long-term opportunity, but not recommended for early-stage resource allocation.',
  },
  'Canada': {
    stats: [
      { label: 'IVF CAGR',          value: '6-8%' },
      { label: 'GDP Growth',         value: '1.5-2.5%' },
    ],
    context: 'Canada offers a stable, English-speaking market with moderate IVF growth and broad cultural alignment with Genie\'s UK positioning. Provincial funding disparities create uneven commercial conditions, and a fragmented clinic landscape reduces B2B efficiency. A solid but unspectacular opportunity - best suited to a later phase of international rollout once core markets are established.',
  },
  'Greece': {
    stats: [
      { label: 'IVF CAGR',          value: '10-12%' },
      { label: 'GDP Growth',         value: '2.0-3.0%' },
    ],
    context: 'Greece has emerged as a growing European IVF hub, attracting medical tourism from across the continent with competitive pricing and an improving regulatory environment. Inbound cycle volumes from Northern and Eastern Europe are rising steadily. Limited domestic purchasing power and a fragmented clinic landscape constrain scale, though proximity to London reduces operational overhead.',
  },
  'Japan': {
    stats: [
      { label: 'IVF CAGR',          value: '3-5%' },
      { label: 'GDP Growth',         value: '0.5-1.5%' },
    ],
    context: 'Japan performs more IVF cycles in absolute terms than any other country, yet presents severe barriers for Genie: strict data localisation requirements prevent cross-border processing, regulatory timelines for AI-based SaMD exceed two years, and cultural conservatism slows adoption of novel diagnostics. A compelling long-term prize contingent on structural regulatory reform - not recommended for the current planning horizon.',
  },
  'Italy': {
    stats: [
      { label: 'IVF CAGR',          value: '5-7%' },
      { label: 'GDP Growth',         value: '0.7-1.2%' },
    ],
    context: 'Italy\'s restrictive ART legislation - a legacy of the 2004 Law 40 - continues to constrain embryo selection and diagnostic innovation despite partial reform. A low willingness to pay for private diagnostics, fragmented clinic ownership, and limited digital health adoption compound the regulatory difficulty. The commercial opportunity for Genie\'s core offering is materially limited; deprioritise in the near term.',
  },
  'Cyprus': {
    stats: [
      { label: 'IVF CAGR',          value: '12-15%' },
      { label: 'GDP Growth',         value: '2.5-3.5%' },
    ],
    context: 'Cyprus punches above its weight as a Mediterranean IVF hub, attracting international patients from the Middle East, Eastern Europe, and the UK seeking affordable cycles in an EU-regulated environment. However, extremely small absolute market size and limited KOL infrastructure significantly cap the strategic value of a Genie entry. Monitor as a secondary opportunity once Tier 1 and 2 markets are operational.',
  },
};

export const ORIG_DATA = [
  { name:'Spain',          s:{c11:5,c12:5,c13:4,c21:4,c22:5,c23:4,c31:5,c32:5,c33:4,c34:5} },
  { name:'United Kingdom', s:{c11:4,c12:3,c13:3,c21:5,c22:5,c23:5,c31:5,c32:3,c33:4,c34:5} },
  { name:'Denmark',        s:{c11:2,c12:4,c13:5,c21:4,c22:5,c23:4,c31:5,c32:4,c33:5,c34:5} },
  { name:'Australia',      s:{c11:4,c12:4,c13:5,c21:4,c22:4,c23:5,c31:4,c32:5,c33:5,c34:2} },
  { name:'Germany',        s:{c11:4,c12:3,c13:3,c21:3,c22:4,c23:3,c31:4,c32:3,c33:4,c34:5} },
  { name:'Canada',         s:{c11:3,c12:3,c13:3,c21:3,c22:3,c23:3,c31:3,c32:3,c33:4,c34:3} },
  { name:'Greece',         s:{c11:2,c12:3,c13:2,c21:3,c22:4,c23:3,c31:3,c32:3,c33:2,c34:4} },
  { name:'Japan',          s:{c11:5,c12:3,c13:3,c21:1,c22:2,c23:1,c31:2,c32:2,c33:4,c34:1} },
  { name:'Italy',          s:{c11:2,c12:1,c13:1,c21:2,c22:4,c23:2,c31:3,c32:2,c33:2,c34:4} },
  { name:'Cyprus',         s:{c11:1,c12:2,c13:2,c21:3,c22:4,c23:3,c31:2,c32:3,c33:1,c34:4} },
];
