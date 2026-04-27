'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarPlus, ClipboardList, User } from 'lucide-react';

interface NavItem {
  href:  string;
  label: string;
  Icon:  React.ComponentType<{ size?: number; strokeWidth?: number }>;
  badge?: number;
}

interface BottomNavProps {
  unreadCount?: number;
}

export function BottomNav({ unreadCount = 0 }: BottomNavProps) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: '/inicio',    label: 'Início',    Icon: Home,          badge: unreadCount },
    { href: '/agendar',   label: 'Agendar',   Icon: CalendarPlus },
    { href: '/consultas', label: 'Consultas', Icon: ClipboardList },
    { href: '/perfil',    label: 'Perfil',    Icon: User },
  ];

  return (
    <nav
      className="bottom-nav"
      style={{
        position:        'fixed',
        bottom:          0,
        left:            0,
        right:           0,
        zIndex:          50,
        backgroundColor: '#ffffff',
        borderTop:       '1px solid #e5e5e5',
        display:         'flex',
        justifyContent:  'space-around',
        paddingTop:      '8px',
      }}
      aria-label="Navegação principal"
    >
      {items.map(({ href, label, Icon, badge }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:            '4px',
              flex:           1,
              padding:        '8px 4px',
              minHeight:      '56px',
              textDecoration: 'none',
              color:          isActive ? '#b8860b' : '#737373',
              position:       'relative',
              transition:     'color 0.15s',
            }}
          >
            <span style={{ position: 'relative' }}>
              <Icon size={24} strokeWidth={isActive ? 2.5 : 1.75} />
              {badge != null && badge > 0 && (
                <span
                  aria-label={`${badge} avisos não lidos`}
                  style={{
                    position:        'absolute',
                    top:             '-4px',
                    right:           '-6px',
                    minWidth:        '18px',
                    height:          '18px',
                    padding:         '0 4px',
                    backgroundColor: '#ef4444',
                    color:           '#ffffff',
                    fontSize:        '11px',
                    fontWeight:      700,
                    lineHeight:      '18px',
                    borderRadius:    '9px',
                    textAlign:       'center',
                  }}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            <span
              style={{
                fontSize:   '11px',
                fontWeight: isActive ? 600 : 400,
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
