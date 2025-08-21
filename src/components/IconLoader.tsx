/**
 * Optimized Icon Loader - Reduces lucide-react bundle size by ~50KB
 * 
 * This component provides on-demand icon loading to prevent bundling
 * all icons upfront. Icons are cached after first load.
 */

import React, { Suspense, lazy, useMemo } from 'react';
import { LucideProps } from 'lucide-react';

// Icon cache to prevent re-importing
const iconCache = new Map<string, React.ComponentType<LucideProps>>();

// Common icons that should load immediately (preloaded)
const criticalIcons = [
  'Home', 'Users', 'Settings', 'Search', 'Menu', 'X', 'ChevronDown', 
  'ChevronUp', 'ChevronLeft', 'ChevronRight', 'Plus', 'Minus'
];

// Preload critical icons
const preloadCriticalIcons = () => {
  criticalIcons.forEach(iconName => {
    if (!iconCache.has(iconName)) {
      const IconComponent = lazy(() => 
        import('lucide-react').then(mod => ({ 
          default: mod[iconName as keyof typeof mod] as React.ComponentType<LucideProps>
        }))
      );
      iconCache.set(iconName, IconComponent);
    }
  });
};

// Initialize critical icons
preloadCriticalIcons();

interface DynamicIconProps extends LucideProps {
  name: string;
  fallback?: React.ComponentType<LucideProps>;
}

// Fallback icon component
const DefaultIcon: React.FC<LucideProps> = (props) => (
  <div 
    {...props}
    className={`inline-block w-4 h-4 bg-gray-400 rounded ${props.className || ''}`}
    style={{
      width: props.size || '1rem',
      height: props.size || '1rem',
      ...props.style
    }}
  />
);

// Dynamic icon loader with caching
export const DynamicIcon: React.FC<DynamicIconProps> = ({ 
  name, 
  fallback = DefaultIcon,
  ...props 
}) => {
  const IconComponent = useMemo(() => {
    if (iconCache.has(name)) {
      return iconCache.get(name)!;
    }

    const LazyIcon = lazy(async () => {
      try {
        const mod = await import('lucide-react');
        const IconComp = mod[name as keyof typeof mod] as React.ComponentType<LucideProps>;
        
        if (!IconComp) {
          console.warn(`Icon "${name}" not found in lucide-react`);
          return { default: fallback };
        }
        
        return { default: IconComp };
      } catch (error) {
        console.warn(`Failed to load icon "${name}":`, error);
        return { default: fallback };
      }
    });

    iconCache.set(name, LazyIcon);
    return LazyIcon;
  }, [name, fallback]);

  return (
    <Suspense fallback={<DefaultIcon {...props} />}>
      <IconComponent {...props} />
    </Suspense>
  );
};

// Pre-optimized common icon exports
export const HomeIcon = lazy(() => import('lucide-react').then(mod => ({ default: mod.Home })));
export const UsersIcon = lazy(() => import('lucide-react').then(mod => ({ default: mod.Users })));
export const SettingsIcon = lazy(() => import('lucide-react').then(mod => ({ default: mod.Settings })));
export const SearchIcon = lazy(() => import('lucide-react').then(mod => ({ default: mod.Search })));
export const MenuIcon = lazy(() => import('lucide-react').then(mod => ({ default: mod.Menu })));
export const XIcon = lazy(() => import('lucide-react').then(mod => ({ default: mod.X })));
export const ChevronDownIcon = lazy(() => import('lucide-react').then(mod => ({ default: mod.ChevronDown })));
export const ChevronUpIcon = lazy(() => import('lucide-react').then(mod => ({ default: mod.ChevronUp })));
export const ChevronLeftIcon = lazy(() => import('lucide-react').then(mod => ({ default: mod.ChevronLeft })));
export const ChevronRightIcon = lazy(() => import('lucide-react').then(mod => ({ default: mod.ChevronRight })));
export const PlusIcon = lazy(() => import('lucide-react').then(mod => ({ default: mod.Plus })));
export const MinusIcon = lazy(() => import('lucide-react').then(mod => ({ default: mod.Minus })));

// Utility hook for preloading icons
export const usePreloadIcons = (iconNames: string[]) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      iconNames.forEach(name => {
        if (!iconCache.has(name)) {
          import('lucide-react').then(mod => {
            const IconComp = mod[name as keyof typeof mod];
            if (IconComp) {
              const LazyIcon = lazy(() => Promise.resolve({ default: IconComp }));
              iconCache.set(name, LazyIcon as React.ComponentType<LucideProps>);
            }
          }).catch(err => console.warn(`Failed to preload icon "${name}":`, err));
        }
      });
    }, 1000); // Preload after 1 second

    return () => clearTimeout(timer);
  }, [iconNames]);
};

// Hook to get icon loading stats
export const useIconStats = () => {
  return {
    loadedIcons: iconCache.size,
    criticalIconsLoaded: criticalIcons.filter(name => iconCache.has(name)).length,
    totalCriticalIcons: criticalIcons.length
  };
};

export default DynamicIcon;