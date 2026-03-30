import type { VenueTierConfig } from './types'

export const VENUE_TIERS: VenueTierConfig[] = [
  {
    venueName: 'Ball Arena',
    aliases: ['ball arena', 'pepsi center'],
    tiers: ['Floor/VIP', 'Club Level', 'Lower Bowl', 'Upper Bowl'],
  },
  {
    venueName: 'Red Rocks Amphitheatre',
    aliases: ['red rocks', 'red rocks amphitheatre', 'red rocks amphitheater'],
    tiers: ['Floor/Pit', 'Reserved Rows 1-30', 'Reserved Rows 31-69', 'GA'],
  },
  {
    venueName: 'Empower Field at Mile High',
    aliases: ['empower field', 'mile high', 'mile high stadium'],
    tiers: ['Floor/Field', 'Club Level', 'Lower Bowl 100s', 'Upper Bowl 200s', 'Upper Bowl 500s'],
  },
  {
    venueName: 'Coors Field',
    aliases: ['coors field'],
    tiers: ['Field Level/Dugout', 'Club Level', 'Lower Pavilion', 'Upper Pavilion', 'Rooftop/Rockpile'],
  },
  {
    venueName: "Fiddler's Green Amphitheatre",
    aliases: ["fiddler's green", 'fiddlers green'],
    tiers: ['Pit', 'Reserved Pavilion', 'GA Lawn'],
  },
  {
    venueName: 'Paramount Theatre',
    aliases: ['paramount theatre', 'paramount theater'],
    tiers: ['Orchestra', 'Mezzanine', 'Balcony'],
  },
  {
    venueName: '1STBANK Center',
    aliases: ['1stbank center', '1st bank center', 'first bank center'],
    tiers: ['Floor', 'Lower Bowl', 'Upper Bowl'],
  },
  {
    venueName: "Dick's Sporting Goods Park",
    aliases: ["dick's sporting goods park", 'dicks sporting goods park', 'dsg park'],
    tiers: ['Sideline', 'Corner', 'End Line', 'GA'],
  },
  {
    venueName: 'Denver Center for the Performing Arts',
    aliases: ['dcpa', 'denver center', 'buell theatre', 'ellie caulkins'],
    tiers: ['Orchestra', 'Mezzanine', 'Balcony', 'Gallery'],
  },
  // National venues
  {
    venueName: 'Madison Square Garden',
    aliases: ['msg', 'madison square garden'],
    tiers: ['Floor/VIP', 'Lower Bowl 100s', 'Club 200s', 'Upper Bowl 300s', 'Chase Bridge'],
  },
  {
    venueName: 'SoFi Stadium',
    aliases: ['sofi stadium', 'sofi'],
    tiers: ['Floor/Field', 'Club Level', 'Lower Bowl 100s', 'Mid Level 200s', 'Upper Bowl 300s'],
  },
  {
    venueName: 'Crypto.com Arena',
    aliases: ['crypto.com arena', 'staples center', 'crypto arena'],
    tiers: ['Floor/Courtside', 'Premier', 'Lower Bowl 100s', 'Upper Bowl 300s'],
  },
  {
    venueName: 'Chase Center',
    aliases: ['chase center'],
    tiers: ['Floor/Courtside', 'Lower Bowl 100s', 'Club 200s', 'Upper Bowl'],
  },
  {
    venueName: 'United Center',
    aliases: ['united center'],
    tiers: ['Floor', 'Lower Bowl 100s', 'Club 200s', 'Upper Bowl 300s'],
  },
  {
    venueName: 'MetLife Stadium',
    aliases: ['metlife stadium', 'metlife'],
    tiers: ['Floor/Field', 'Club Level', 'Lower Bowl 100s', 'Mezzanine 200s', 'Upper Bowl 300s'],
  },
  {
    venueName: 'Hollywood Bowl',
    aliases: ['hollywood bowl'],
    tiers: ['Pool Circle', 'Garden Boxes', 'Terrace', 'Bench'],
  },
]

export const DEFAULT_TIERS = ['Floor/VIP', 'Lower Bowl', 'Mid Level', 'Upper Bowl', 'GA']

export function getTiersForVenue(venueName: string): string[] {
  if (!venueName) return DEFAULT_TIERS
  const lower = venueName.toLowerCase()
  for (const config of VENUE_TIERS) {
    if (lower.includes(config.venueName.toLowerCase())) return config.tiers
    for (const alias of config.aliases) {
      if (lower.includes(alias)) return config.tiers
    }
  }
  return DEFAULT_TIERS
}
