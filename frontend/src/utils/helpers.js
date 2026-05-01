export const STATUS_CONFIG = {
  PENDING:  { label: 'Pending',  color: 'bg-slate-700 text-slate-300',   dot: 'bg-slate-400'  },
  SENT:     { label: 'Sent',     color: 'bg-blue-900/60 text-blue-300',  dot: 'bg-blue-400'   },
  APPROVED: { label: 'Approved', color: 'bg-green-900/60 text-green-300',dot: 'bg-green-400'  },
  REJECTED: { label: 'Rejected', color: 'bg-red-900/60 text-red-300',    dot: 'bg-red-400'    },
  POSTED:   { label: 'Posted',   color: 'bg-purple-900/60 text-purple-300', dot: 'bg-purple-400' },
};

export const CONTENT_TYPE_COLORS = {
  Post:     'bg-blue-900/40 text-blue-300',
  Reel:     'bg-pink-900/40 text-pink-300',
  Carousel: 'bg-orange-900/40 text-orange-300',
  Story:    'bg-yellow-900/40 text-yellow-300',
};

export const PROVIDERS = [
  { value: 'DALLE',    label: 'DALL-E 3'         },
  { value: 'REPLICATE', label: 'Flux-Schnell'    },
  { value: 'GEMINI',   label: 'Imagen 3 (Gemini)'},
];

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function truncate(str, n = 100) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export function getDaysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

export function getFirstDayOfMonth(month, year) {
  return new Date(year, month - 1, 1).getDay();
}
