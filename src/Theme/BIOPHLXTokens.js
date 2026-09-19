export const palettes = {
  light: { primary: '#E60019', accent: '#C80017', background: '#F5F6F8', surface: '#FFFFFF', raised: '#ECEEF1', text: '#242831', muted: '#606570', border: '#DDE0E5', onPrimary: '#FFFFFF' },
  dark: { primary: '#E60019', accent: '#FF6575', background: '#0C0D0F', surface: '#191B1E', raised: '#272A2F', text: '#F7F7F8', muted: '#BEC2CA', border: '#3B3E44', onPrimary: '#FFFFFF' },
};

// Bridge existing screen styles to semantic brand tokens. Status greens/ambers,
// skin tones, chart data and transparent colors retain their meaning.
export function resolveColor(value, property, palette, role = '') {
  if (typeof value !== 'string') return value;
  const raw = value.toLowerCase();
  if (Object.entries(palette).some(([key, color]) => key !== 'onPrimary' && color.toLowerCase() === raw)) return value;
  if (raw.startsWith('rgba(')) return property === 'backgroundColor' && /overlay/i.test(role) ? 'rgba(0,0,0,0.65)' : value;
  let hex = ({ white: '#ffffff', black: '#000000', crimson: '#dc143c', red: '#ff0000', blue: '#0000ff', gray: '#808080', grey: '#808080' })[raw] || raw;
  if (/^#[0-9a-f]{8}$/.test(hex) && property === 'backgroundColor') return '#000000' + hex.slice(7);
  if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(hex)) return value;
  if (hex.length === 4) hex = '#' + [...hex.slice(1)].map(x => x+x).join('');
  const [r,g,b] = [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const max = Math.max(r,g,b), min = Math.min(r,g,b), chroma=max-min;
  if (g > r * 1.3 && g > b * 1.25) return value;
  const foreground = property === 'color' || property === 'tintColor';
  if (property === 'shadowColor') return '#000000';
  if (/border/i.test(property)) return palette.border;
  const brand = (((chroma > .3 && max > .35) || (chroma > .18 && max > .55)) && (b > r*1.15 || (g > r*1.25 && b > r*1.25) || (r > g*1.7 && r > b*1.25)));
  if (brand) return foreground ? palette.accent : palette.primary;
  const neutral = chroma < .2 || (b >= r && max < .6);
  if (!neutral) return value;
  if (foreground) return min > .96 ? palette.onPrimary : max > .4 ? palette.muted : palette.text;
  if (/background/i.test(property)) {
    if (max < .35 && /button|btn|submit|action|toggleActive/i.test(role)) return palette.primary;
    return /container|screen|root|page/i.test(role) ? palette.background : max > .96 ? palette.surface : palette.raised;
  }
  return value;
}
